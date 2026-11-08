import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "../project/project";
import { KUCHI } from "../testing/fixtures";
import {
  INDEX_KEY,
  LEGACY_AUTOSAVE_KEY,
  createProjectId,
  debounce,
  deleteProject,
  hasContent,
  isProjectId,
  listProjects,
  loadProject,
  migrateLegacyAutosave,
  projectHref,
  projectKey,
  saveProject,
  type KeyValueStore,
} from "./repository";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => structuredClone(data.get(k)),
    set: async (k, v) => void data.set(k, structuredClone(v)),
    setMany: async (entries) => entries.forEach(([k, v]) => data.set(k, structuredClone(v))),
    del: async (k) => void data.delete(k),
  };
}

const ID_A = "0b8e6c4e-2f1a-4c3b-9d5e-7a6b5c4d3e2f";
const ID_B = "1c9f7d5f-3a2b-4d4c-8e6f-8b7c6d5e4f30";

afterEach(() => vi.useRealTimers());

function sample() {
  const p = createEmptyProject("Foo");
  p.queue = ["口", "未"];
  p.glyphs = { 口: KUCHI };
  p.previewText = "口未";
  return p;
}

describe("ID", () => {
  it("UUID の形だけを受け付ける", () => {
    expect(isProjectId(createProjectId())).toBe(true);
    expect(isProjectId(ID_A)).toBe(true);
    expect(isProjectId("../x")).toBe(false);
    expect(isProjectId(ID_A.toUpperCase())).toBe(false);
    expect(isProjectId(null)).toBe(false);
  });
  it("projectHref", () => {
    expect(projectHref("/editor", ID_A)).toBe(`/editor/?uuid=${ID_A}`);
    expect(projectHref("/preview", null)).toBe("/preview/");
  });
});

describe("saveProject / loadProject / listProjects / deleteProject", () => {
  it("プロジェクトごとに保存し、一覧は新しく更新した順", async () => {
    const kv = memoryStore();
    await saveProject(kv, ID_A, sample(), true, new Date("2026-11-08T00:00:00Z"));
    const b = createEmptyProject("Bar");
    b.queue = ["x"];
    await saveProject(kv, ID_B, b, false, new Date("2026-11-08T01:00:00Z"));
    expect(await loadProject(kv, ID_A)).toEqual({ project: sample(), dirty: true });
    const list = await listProjects(kv);
    expect(list.map((s) => s.id)).toEqual([ID_B, ID_A]);
    expect(list[1]).toMatchObject({ familyName: "Foo", charCount: 2, glyphCount: 1 });

    // 保存し直すと一覧の先頭に来る
    await saveProject(kv, ID_A, sample(), false, new Date("2026-11-08T02:00:00Z"));
    expect((await listProjects(kv)).map((s) => s.id)).toEqual([ID_A, ID_B]);

    await deleteProject(kv, ID_A);
    expect(await loadProject(kv, ID_A)).toBeNull();
    expect((await listProjects(kv)).map((s) => s.id)).toEqual([ID_B]);
  });

  it("ID が正しくなければ保存しない・読まない", async () => {
    const kv = memoryStore();
    await expect(saveProject(kv, "x", sample(), false)).rejects.toThrow();
    expect(await loadProject(kv, "x")).toBeNull();
  });

  it("ない・形が違う・読めないときは null や空", async () => {
    const kv = memoryStore();
    expect(await loadProject(kv, ID_A)).toBeNull();
    expect(await listProjects(kv)).toEqual([]);
    kv.data.set(projectKey(ID_A), { version: 99 });
    kv.data.set(INDEX_KEY, [{ id: "bad" }, "x"]);
    expect(await loadProject(kv, ID_A)).toBeNull();
    expect(await listProjects(kv)).toEqual([]);
    kv.data.set(INDEX_KEY, "x");
    expect(await listProjects(kv)).toEqual([]);
    const broken: KeyValueStore = { ...kv, get: () => Promise.reject(new Error("blocked")) };
    expect(await loadProject(broken, ID_A)).toBeNull();
    expect(await listProjects(broken)).toEqual([]);
    expect(await migrateLegacyAutosave(broken)).toBeNull();
  });

  it("壊れたグリフ・正しくない文字は捨て、名前は直す", async () => {
    const kv = memoryStore();
    const p = createEmptyProject();
    p.queue = ["口", "ab"];
    p.glyphs = { 口: KUCHI, x: { ...KUCHI } };
    await saveProject(kv, ID_A, p, false);
    const stored = kv.data.get(projectKey(ID_A)) as { project: { font: { familyName: string } } };
    stored.project.font.familyName = "日本語";
    const r = await loadProject(kv, ID_A);
    expect(Object.keys(r!.project.glyphs)).toEqual(["口"]);
    expect(r!.project.queue).toEqual(["口"]);
    expect(r!.project.font.familyName).toBe("MyHandwriting");
  });
});

describe("migrateLegacyAutosave", () => {
  it("前の版の自動保存を新しいプロジェクトとして引き継ぎ、元のデータを消す", async () => {
    const kv = memoryStore();
    kv.data.set(LEGACY_AUTOSAVE_KEY, {
      version: 1,
      savedAt: "2026-11-01T00:00:00.000Z",
      dirty: true,
      project: sample(),
    });
    const id = await migrateLegacyAutosave(kv);
    expect(isProjectId(id)).toBe(true);
    expect(await loadProject(kv, id!)).toEqual({ project: sample(), dirty: true });
    expect(kv.data.has(LEGACY_AUTOSAVE_KEY)).toBe(false);
    expect(await migrateLegacyAutosave(kv)).toBeNull();
  });
  it("中身がない・形が違うものは引き継がずに消す", async () => {
    const kv = memoryStore();
    kv.data.set(LEGACY_AUTOSAVE_KEY, {
      version: 1,
      savedAt: "",
      dirty: false,
      project: createEmptyProject(),
    });
    expect(await migrateLegacyAutosave(kv)).toBeNull();
    kv.data.set(LEGACY_AUTOSAVE_KEY, "x");
    expect(await migrateLegacyAutosave(kv)).toBeNull();
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
    expect(d.pending()).toBe(true);
    d.flush();
    expect(d.pending()).toBe(false);
    expect(fn).toHaveBeenCalledExactlyOnceWith(3);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
