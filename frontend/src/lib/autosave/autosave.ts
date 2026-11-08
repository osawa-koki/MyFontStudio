import { z } from "zod";
import type { Project } from "../../types/project";
import { penParamsSchema, vectorSchema } from "../archive/schema";
import { DEFAULT_FAMILY_NAME, sanitizeDisplayName, sanitizeFamilyName } from "../project/project";

/** 保存先（IndexedDB。テストでは差し替える） */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export const AUTOSAVE_KEY = "myfontstudio:autosave";
export const AUTOSAVE_VERSION = 1;
/** ストアが変わってから保存するまでの待ち時間 */
export const AUTOSAVE_DELAY_MS = 500;

export interface Snapshot {
  version: number;
  savedAt: string;
  project: Project;
  /** zip に保存していない変更があったか（「未保存」バッジを戻す） */
  dirty: boolean;
}

const snapshotSchema = z.object({
  version: z.literal(AUTOSAVE_VERSION),
  savedAt: z.string(),
  dirty: z.boolean(),
  project: z.object({
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
  }),
});

export async function saveSnapshot(
  kv: KeyValueStore,
  project: Project,
  dirty: boolean,
  now: Date = new Date(),
): Promise<void> {
  const snapshot: Snapshot = {
    version: AUTOSAVE_VERSION,
    savedAt: now.toISOString(),
    project,
    dirty,
  };
  await kv.set(AUTOSAVE_KEY, snapshot);
}

/** 保存したデータを読む。ない・形が違うときは null。壊れたグリフは捨てる */
export async function loadSnapshot(kv: KeyValueStore): Promise<Snapshot | null> {
  let raw: unknown;
  try {
    raw = await kv.get(AUTOSAVE_KEY);
  } catch {
    return null;
  }
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { project: p, ...rest } = parsed.data;
  const glyphs: Project["glyphs"] = {};
  for (const [char, value] of Object.entries(p.glyphs)) {
    const g = vectorSchema.safeParse(value);
    if (g.success && g.data.char === char) glyphs[char] = g.data;
  }
  return {
    ...rest,
    project: {
      ...p,
      font: {
        ...p.font,
        familyName: sanitizeFamilyName(p.font.familyName) || DEFAULT_FAMILY_NAME,
        familyNameJa: sanitizeDisplayName(p.font.familyNameJa),
        designer: sanitizeDisplayName(p.font.designer),
      },
      queue: p.queue.filter((c) => Array.from(c).length === 1),
      glyphs,
    },
  };
}

export async function clearSnapshot(kv: KeyValueStore): Promise<void> {
  await kv.del(AUTOSAVE_KEY);
}

/** 復元を勧める価値のある内容か（文字が 1 つもなければ聞かない） */
export function hasContent(project: Project): boolean {
  return project.queue.length > 0 || Object.keys(project.glyphs).length > 0;
}

/** 最後の呼び出しから delay ミリ秒たってから 1 回だけ実行する */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): ((...args: A) => void) & { cancel(): void; flush(): void } {
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
  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  return debounced;
}
