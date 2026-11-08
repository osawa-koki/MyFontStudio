// プロジェクトの保存先（IndexedDB）。プロジェクトごとに UUID を振り、データと一覧を分けて保存する
import { z } from "zod";
import type { Project } from "../../types/project";
import { penParamsSchema, vectorSchema } from "../archive/schema";
import { DEFAULT_FAMILY_NAME, sanitizeDisplayName, sanitizeFamilyName } from "../project/project";

/** 保存先（IndexedDB。テストでは差し替える） */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  /** まとめて書く（IndexedDB では 1 つのトランザクションになり、途中で閉じても一部だけ書かれることがない） */
  setMany(entries: [string, unknown][]): Promise<void>;
  del(key: string): Promise<void>;
}

export const INDEX_KEY = "myfontstudio:projects";
export const projectKey = (id: string) => `myfontstudio:project:${id}`;
/** 前の版（プロジェクトが 1 つだけ）の自動保存のキー */
export const LEGACY_AUTOSAVE_KEY = "myfontstudio:autosave";
export const STORED_VERSION = 1;
/** ストアが変わってから保存するまでの待ち時間 */
export const SAVE_DELAY_MS = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isProjectId = (s: string | null | undefined): s is string => !!s && UUID.test(s);
export const createProjectId = (): string => crypto.randomUUID();

/** 一覧に出す要約 */
export interface ProjectSummary {
  id: string;
  familyName: string;
  familyNameJa: string;
  /** 文字一覧の文字数 */
  charCount: number;
  /** 作成済みの文字数 */
  glyphCount: number;
  /** ISO 8601 */
  updatedAt: string;
}

export interface StoredProject {
  project: Project;
  /** zip に保存していない変更があるか（「未保存」バッジ） */
  dirty: boolean;
}

const projectSchema = z.object({
  font: z.object({
    familyName: z.string(),
    familyNameJa: z.string(),
    designer: z.string(),
    exportCount: z.number().int().min(0),
  }),
  defaults: z.object({ pen: penParamsSchema, usePressure: z.boolean(), showModel: z.boolean() }),
  queue: z.array(z.string()),
  previewText: z.string(),
  glyphs: z.record(z.string(), z.unknown()),
});

const storedSchema = z.object({
  version: z.literal(STORED_VERSION),
  savedAt: z.string(),
  dirty: z.boolean(),
  project: projectSchema,
});

const summarySchema = z.object({
  id: z.string().regex(UUID),
  familyName: z.string(),
  familyNameJa: z.string(),
  charCount: z.number(),
  glyphCount: z.number(),
  updatedAt: z.string(),
});

/** 保存したプロジェクトを確かめて直す。壊れたグリフ・正しくない文字は捨て、名前は直す */
function sanitizeProject(p: z.infer<typeof projectSchema>): Project {
  const glyphs: Project["glyphs"] = {};
  for (const [char, value] of Object.entries(p.glyphs)) {
    const g = vectorSchema.safeParse(value);
    if (g.success && g.data.char === char) glyphs[char] = g.data;
  }
  return {
    ...p,
    font: {
      ...p.font,
      familyName: sanitizeFamilyName(p.font.familyName) || DEFAULT_FAMILY_NAME,
      familyNameJa: sanitizeDisplayName(p.font.familyNameJa),
      designer: sanitizeDisplayName(p.font.designer),
    },
    queue: p.queue.filter((c) => Array.from(c).length === 1),
    glyphs,
  };
}

export function summarize(id: string, project: Project, now: Date = new Date()): ProjectSummary {
  return {
    id,
    familyName: project.font.familyName,
    familyNameJa: project.font.familyNameJa,
    charCount: project.queue.length,
    glyphCount: Object.values(project.glyphs).filter((g) => g.strokes.length > 0).length,
    updatedAt: now.toISOString(),
  };
}

/** 保存したプロジェクトの一覧（新しく更新した順）。読めないときは空 */
export async function listProjects(kv: KeyValueStore): Promise<ProjectSummary[]> {
  let raw: unknown;
  try {
    raw = await kv.get(INDEX_KEY);
  } catch {
    return [];
  }
  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data
    .map((x) => summarySchema.safeParse(x))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadProject(kv: KeyValueStore, id: string): Promise<StoredProject | null> {
  if (!isProjectId(id)) return null;
  let raw: unknown;
  try {
    raw = await kv.get(projectKey(id));
  } catch {
    return null;
  }
  const parsed = storedSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { project: sanitizeProject(parsed.data.project), dirty: parsed.data.dirty };
}

/** プロジェクトを保存し、一覧を更新する（データと一覧は 1 つのトランザクションで書く） */
export async function saveProject(
  kv: KeyValueStore,
  id: string,
  project: Project,
  dirty: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (!isProjectId(id)) throw new Error("プロジェクトの ID が正しくない");
  const list = (await listProjects(kv)).filter((s) => s.id !== id);
  await kv.setMany([
    [projectKey(id), { version: STORED_VERSION, savedAt: now.toISOString(), dirty, project }],
    [INDEX_KEY, [summarize(id, project, now), ...list]],
  ]);
}

/** プロジェクトを消す。先に一覧から外す（途中で閉じても、一覧に消えたプロジェクトが残らないように） */
export async function deleteProject(kv: KeyValueStore, id: string): Promise<void> {
  const list = (await listProjects(kv)).filter((s) => s.id !== id);
  await kv.set(INDEX_KEY, list);
  await kv.del(projectKey(id));
}

/**
 * 前の版の自動保存（プロジェクトが 1 つだけ）のデータがあれば、新しい ID のプロジェクトとして引き継ぎ、元のデータを消す。
 * 引き継いだら ID を返す
 */
export async function migrateLegacyAutosave(kv: KeyValueStore): Promise<string | null> {
  let raw: unknown;
  try {
    raw = await kv.get(LEGACY_AUTOSAVE_KEY);
  } catch {
    return null;
  }
  if (raw === undefined) return null;
  const parsed = storedSchema.safeParse(raw);
  let id: string | null = null;
  if (parsed.success && hasContent(parsed.data.project as Project)) {
    id = createProjectId();
    await saveProject(
      kv,
      id,
      sanitizeProject(parsed.data.project),
      parsed.data.dirty,
      new Date(parsed.data.savedAt),
    );
  }
  await kv.del(LEGACY_AUTOSAVE_KEY);
  return id;
}

/** 保存する価値のある内容か（文字が 1 つもない新しいプロジェクトは保存しない） */
export function hasContent(project: Project): boolean {
  return project.queue.length > 0 || Object.keys(project.glyphs).length > 0;
}

/** 最後の呼び出しから delay ミリ秒たってから 1 回だけ実行する */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): ((...args: A) => void) & { cancel(): void; flush(): void; pending(): boolean } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  const run = () => {
    timer = null;
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  const debounced = (...args: A) => {
    pending = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, delay);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  debounced.pending = () => pending !== null;
  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  return debounced;
}

/** プロジェクトを開く URL（/editor/?uuid=xxx） */
export function projectHref(path: "/editor" | "/preview", id: string | null): string {
  return id ? `${path}/?uuid=${id}` : `${path}/`;
}
