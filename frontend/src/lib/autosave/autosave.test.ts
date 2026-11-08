import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "../project/project";
import { KUCHI } from "../testing/fixtures";
import {
  AUTOSAVE_KEY,
  clearSnapshot,
  debounce,
  hasContent,
  loadSnapshot,
  saveSnapshot,
  type KeyValueStore,
} from "./autosave";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => structuredClone(data.get(k)),
    set: async (k, v) => void data.set(k, structuredClone(v)),
    del: async (k) => void data.delete(k),
  };
}

afterEach(() => vi.useRealTimers());

describe("saveSnapshot / loadSnapshot", () => {
  it("保存したプロジェクトを読み戻せる", async () => {
    const kv = memoryStore();
    const p = createEmptyProject("Foo");
    p.queue = ["口", "未"];
    p.glyphs = { 口: KUCHI };
    p.previewText = "口未";
    await saveSnapshot(kv, p, true, new Date("2026-11-08T00:00:00Z"));
    const s = await loadSnapshot(kv);
    expect(s).toMatchObject({ version: 1, savedAt: "2026-11-08T00:00:00.000Z", dirty: true });
    expect(s!.project).toEqual(p);
  });

  it("ない・形が違う・読めないときは null", async () => {
    const kv = memoryStore();
    expect(await loadSnapshot(kv)).toBeNull();
    kv.data.set(AUTOSAVE_KEY, { version: 99 });
    expect(await loadSnapshot(kv)).toBeNull();
    const broken: KeyValueStore = { ...kv, get: () => Promise.reject(new Error("blocked")) };
    expect(await loadSnapshot(broken)).toBeNull();
  });

  it("壊れたグリフ・正しくない文字は捨て、名前は直す", async () => {
    const kv = memoryStore();
    const p = createEmptyProject();
    p.queue = ["口", "ab"];
    p.glyphs = { 口: KUCHI, x: { ...KUCHI } };
    await saveSnapshot(kv, p, false);
    const stored = kv.data.get(AUTOSAVE_KEY) as { project: { font: { familyName: string } } };
    stored.project.font.familyName = "日本語";
    const s = await loadSnapshot(kv);
    expect(Object.keys(s!.project.glyphs)).toEqual(["口"]);
    expect(s!.project.queue).toEqual(["口"]);
    expect(s!.project.font.familyName).toBe("MyHandwriting");
  });

  it("clearSnapshot", async () => {
    const kv = memoryStore();
    await saveSnapshot(kv, createEmptyProject(), false);
    await clearSnapshot(kv);
    expect(kv.data.size).toBe(0);
  });
});

describe("hasContent", () => {
  it("文字があるか", () => {
    const p = createEmptyProject();
    expect(hasContent(p)).toBe(false);
    p.queue = ["a"];
    expect(hasContent(p)).toBe(true);
  });
});

describe("debounce", () => {
  it("最後の呼び出しから待ってから 1 回だけ実行する", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d(1);
    vi.advanceTimersByTime(300);
    d(2);
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("cancel と flush", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d(1);
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    d(3);
    d.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith(3);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
