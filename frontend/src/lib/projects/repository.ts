// プロジェクトの保存先（IndexedDB）。プロジェクトごとに UUID を振り、データと一覧を分けて保存する
import { z } from "zod";
import type { Project } from "../../types/project";
import { drawingSchema, penParamsSchema, vectorSchema } from "../archive/schema";
import {
  DEFAULT_FAMILY_NAME,
  sanitizeDisplayName,
  sanitizeFamilyName,
  toCodepointLabel,
} from "../project/project";

/** 保存先（IndexedDB。テストでは差し替える） */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  getMany(keys: string[]): Promise<unknown[]>;
  set(key: string, value: unknown): Promise<void>;
  /** まとめて書く（IndexedDB では 1 つのトランザクションになり、途中で閉じても一部だけ書かれることがない） */
  setMany(entries: [string, unknown][]): Promise<void>;
  del(key: string): Promise<void>;
  delMany(keys: string[]): Promise<void>;
}

/**
 * IndexedDB の保存先（アプリ専用のデータベース）。GitHub Pages では同じオリジンにほかのサイトがあるので、
 * idb-keyval の既定（keyval-store）を共有しないようにする（仕様 10.4）
 */
export const DB_NAME = "myfontstudio";
export const STORE_NAME = "projects";
/** 前の版の保存先（idb-keyval の既定のデータベース・ストア） */
export const LEGACY_DB_NAME = "keyval-store";
export const LEGACY_STORE_NAME = "keyval";
/** このアプリのキーの先頭 */
export const KEY_PREFIX = "myfontstudio:";

export const INDEX_KEY = "myfontstudio:projects";
/** プロジェクトの設定・文字一覧・文章と、グリフ・描いた履歴のある文字の一覧（メタデータ） */
export const projectKey = (id: string) => `myfontstudio:project:${id}`;
/** 文字ごとのグリフと描いた履歴は別のキーにし、変わった文字だけを書く */
export const glyphKey = (id: string, char: string) =>
  `myfontstudio:project:${id}:glyph:${toCodepointLabel(char)}`;
export const drawingKey = (id: string, char: string) =>
  `myfontstudio:project:${id}:drawing:${toCodepointLabel(char)}`;
/** 前の版（プロジェクトが 1 つだけ）の自動保存のキー */
export const LEGACY_AUTOSAVE_KEY = "myfontstudio:autosave";
/**
 * 保存の形式
 * - 1：プロジェクト全体（グリフ・描いた履歴を含む）を 1 つの値に保存していた
 * - 2：メタデータと、文字ごとのグリフ・描いた履歴を別のキーに分ける（1 本描くたびに全体を書かないように）
 */
export const STORED_VERSION = 2;
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
  // 前の版（描いた履歴を持たない）で保存したものにはない
  drawings: z.record(z.string(), z.unknown()).default({}),
});

/** 形式 1（全体を 1 つの値に保存していた） */
const storedV1Schema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  dirty: z.boolean(),
  project: projectSchema,
});

/** 形式 2 のメタデータ */
const metaSchema = z.object({
  version: z.literal(2),
  savedAt: z.string(),
  dirty: z.boolean(),
  project: projectSchema.omit({ glyphs: true, drawings: true }),
  glyphChars: z.array(z.string()),
  drawingChars: z.array(z.string()),
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
  const drawings: Project["drawings"] = {};
  for (const [char, value] of Object.entries(p.drawings)) {
    const h = drawingSchema.safeParse(value);
    if (h.success && Array.from(char).length === 1) drawings[char] = h.data;
  }
  return {
    ...p,
    drawings,
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

/** 文字の一覧のうち、キーに使える 1 文字のものだけ */
const singleChars = (chars: readonly string[]) => chars.filter((c) => Array.from(c).length === 1);

export async function loadProject(kv: KeyValueStore, id: string): Promise<StoredProject | null> {
  if (!isProjectId(id)) return null;
  try {
    const raw = await kv.get(projectKey(id));
    const meta = metaSchema.safeParse(raw);
    if (meta.success) {
      const glyphChars = singleChars(meta.data.glyphChars);
      const drawingChars = singleChars(meta.data.drawingChars);
      const values = await kv.getMany([
        ...glyphChars.map((c) => glyphKey(id, c)),
        ...drawingChars.map((c) => drawingKey(id, c)),
      ]);
      const glyphs: Record<string, unknown> = {};
      const drawings: Record<string, unknown> = {};
      glyphChars.forEach((c, i) => (glyphs[c] = values[i]));
      drawingChars.forEach((c, i) => (drawings[c] = values[glyphChars.length + i]));
      return {
        project: sanitizeProject({ ...meta.data.project, glyphs, drawings }),
        dirty: meta.data.dirty,
      };
    }
    // 形式 1：読んだら形式 2 に書き直す
    const v1 = storedV1Schema.safeParse(raw);
    if (!v1.success) return null;
    const loaded = { project: sanitizeProject(v1.data.project), dirty: v1.data.dirty };
    await saveProject(kv, id, loaded.project, loaded.dirty, new Date(v1.data.savedAt));
    return loaded;
  } catch {
    return null;
  }
}

/**
 * プロジェクトを保存し、一覧を更新する（書く値はすべて 1 つのトランザクションで書く）。
 * previous（前回保存した内容）を渡すと、変わった文字のグリフ・描いた履歴だけを書き、なくなった文字の値は消す
 */
export async function saveProject(
  kv: KeyValueStore,
  id: string,
  project: Project,
  dirty: boolean,
  now: Date = new Date(),
  previous?: Project,
): Promise<void> {
  if (!isProjectId(id)) throw new Error("プロジェクトの ID が正しくない");
  const glyphChars = Object.keys(project.glyphs).filter((c) => Array.from(c).length === 1);
  const drawingChars = Object.keys(project.drawings).filter((c) => Array.from(c).length === 1);
  const entries: [string, unknown][] = [];
  for (const c of glyphChars) {
    if (project.glyphs[c] !== previous?.glyphs[c])
      entries.push([glyphKey(id, c), project.glyphs[c]]);
  }
  for (const c of drawingChars) {
    if (project.drawings[c] !== previous?.drawings[c])
      entries.push([drawingKey(id, c), project.drawings[c]]);
  }
  const { glyphs: _g, drawings: _d, ...rest } = project;
  void _g;
  void _d;
  entries.push([
    projectKey(id),
    {
      version: STORED_VERSION,
      savedAt: now.toISOString(),
      dirty,
      project: rest,
      glyphChars,
      drawingChars,
    },
  ]);
  const list = (await listProjects(kv)).filter((s) => s.id !== id);
  entries.push([INDEX_KEY, [summarize(id, project, now), ...list]]);
  await kv.setMany(entries);
  if (previous) {
    const removed = [
      ...Object.keys(previous.glyphs)
        .filter((c) => !(c in project.glyphs))
        .map((c) => glyphKey(id, c)),
      ...Object.keys(previous.drawings)
        .filter((c) => !(c in project.drawings))
        .map((c) => drawingKey(id, c)),
    ];
    if (removed.length > 0) await kv.delMany(removed);
  }
}

/** プロジェクトを消す。先に一覧から外す（途中で閉じても、一覧に消えたプロジェクトが残らないように） */
export async function deleteProject(kv: KeyValueStore, id: string): Promise<void> {
  const list = (await listProjects(kv)).filter((s) => s.id !== id);
  await kv.set(INDEX_KEY, list);
  const meta = metaSchema.safeParse(await kv.get(projectKey(id)).catch(() => null));
  const keys = meta.success
    ? [
        ...singleChars(meta.data.glyphChars).map((c) => glyphKey(id, c)),
        ...singleChars(meta.data.drawingChars).map((c) => drawingKey(id, c)),
      ]
    : [];
  await kv.delMany([...keys, projectKey(id)]);
}

/** すべてのキーを読める保存先（前の版の保存先から移すときに使う） */
export interface ListableStore {
  keys(): Promise<unknown[]>;
  getMany(keys: string[]): Promise<unknown[]>;
  delMany(keys: string[]): Promise<void>;
}

/**
 * 前の版の保存先（idb-keyval の既定の keyval-store）から、このアプリのキー（myfontstudio:…）を移し、元の値を消す。
 * 移す先にすでにある値は上書きしない（移す先が正）。ほかのサイトのキーは触らない。移したキーの数を返す
 */
export async function moveAppKeys(from: ListableStore, to: KeyValueStore): Promise<number> {
  const keys = (await from.keys()).filter(
    (k): k is string => typeof k === "string" && k.startsWith(KEY_PREFIX),
  );
  if (keys.length === 0) return 0;
  const [values, existing] = await Promise.all([from.getMany(keys), to.getMany(keys)]);
  const entries = keys
    .map((k, i) => [k, values[i]] as [string, unknown])
    .filter((_, i) => existing[i] === undefined && values[i] !== undefined);
  if (entries.length > 0) await to.setMany(entries);
  await from.delMany(keys);
  return entries.length;
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
  const parsed = storedV1Schema.safeParse(raw);
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
