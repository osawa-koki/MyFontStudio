import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "../project/project";
import { addStroke, createHistory } from "../stroke/history";
import { KUCHI, dot } from "../testing/fixtures";
import {
  INDEX_KEY,
  LEGACY_AUTOSAVE_KEY,
  moveAppKeys,
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
  glyphKey,
  drawingKey,
  type KeyValueStore,
} from "./repository";

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => structuredClone(data.get(k)),
    getMany: async (keys) => keys.map((k) => structuredClone(data.get(k))),
    delMany: async (keys) => keys.forEach((k) => data.delete(k)),
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

describe("文字ごとのキー（形式 2）", () => {
  it("描いた履歴をプロジェクトと一緒に保存し、壊れた値は捨てる", async () => {
    const kv = memoryStore();
    const p = sample();
    p.drawings = { 口: { ops: [{ type: "clear" }], position: 1 } };
    await saveProject(kv, ID_A, p, false);
    expect(kv.data.has(drawingKey(ID_A, "口"))).toBe(true);
    expect(kv.data.has(glyphKey(ID_A, "口"))).toBe(true);
    expect((await loadProject(kv, ID_A))!.project).toEqual(p);
    // 壊れた履歴・グリフは捨てる
    kv.data.set(drawingKey(ID_A, "口"), { ops: [], position: 5 });
    kv.data.set(glyphKey(ID_A, "口"), { char: "x" });
    const loaded = (await loadProject(kv, ID_A))!.project;
    expect(loaded.drawings).toEqual({});
    expect(loaded.glyphs).toEqual({});
  });

  it("前回保存した内容を渡すと、変わった文字だけを書き、なくなった文字の値は消す", async () => {
    const kv = memoryStore();
    const p1 = sample();
    p1.glyphs = { 口: KUCHI, 十: { ...KUCHI, char: "十", codepoint: "U+5341" } };
    p1.drawings = { 口: createHistory(KUCHI.strokes), 十: createHistory() };
    await saveProject(kv, ID_A, p1, false);
    const written: string[] = [];
    const spy: typeof kv = {
      ...kv,
      setMany: async (e) => {
        written.push(...e.map(([k]) => k));
        await kv.setMany(e);
      },
    };
    // 「口」の履歴だけを変え、「十」を消す
    const p2 = {
      ...p1,
      drawings: { 口: addStroke(p1.drawings["口"]!, dot(1, 1)) },
      glyphs: { 口: KUCHI },
    };
    await saveProject(spy, ID_A, p2, true, new Date(), p1);
    expect(written).toEqual([drawingKey(ID_A, "口"), projectKey(ID_A), INDEX_KEY]);
    expect(kv.data.has(glyphKey(ID_A, "十"))).toBe(false);
    expect(kv.data.has(drawingKey(ID_A, "十"))).toBe(false);
    expect(await loadProject(kv, ID_A)).toEqual({ project: p2, dirty: true });
  });

  it("形式 1（全体を 1 つの値）は読み込めて、形式 2 に書き直す。履歴のない古いデータも読める", async () => {
    const kv = memoryStore();
    const p = sample();
    const { drawings: _d, ...withoutDrawings } = p;
    void _d;
    kv.data.set(projectKey(ID_A), {
      version: 1,
      savedAt: "2026-11-01T00:00:00.000Z",
      dirty: true,
      project: withoutDrawings,
    });
    expect(await loadProject(kv, ID_A)).toEqual({ project: p, dirty: true });
    expect((kv.data.get(projectKey(ID_A)) as { version: number }).version).toBe(2);
    expect(kv.data.has(glyphKey(ID_A, "口"))).toBe(true);
    expect((await listProjects(kv)).map((s) => s.id)).toEqual([ID_A]);
  });

  it("削除すると文字ごとの値も消える", async () => {
    const kv = memoryStore();
    const p = sample();
    p.drawings = { 口: createHistory(KUCHI.strokes) };
    await saveProject(kv, ID_A, p, false);
    await deleteProject(kv, ID_A);
    expect([...kv.data.keys()]).toEqual([INDEX_KEY]);
  });
});

describe("moveAppKeys（前の保存先 keyval-store からアプリ専用のデータベースへ）", () => {
  it("このアプリのキーだけを移して元を消す。移す先にある値は上書きしない。ほかのサイトのキーは触らない", async () => {
    const from = memoryStore();
    const to = memoryStore();
    from.data.set(INDEX_KEY, ["old-index"]);
    from.data.set(projectKey(ID_A), { a: 1 });
    from.data.set(LEGACY_AUTOSAVE_KEY, { legacy: true });
    from.data.set("other-site:key", "x");
    to.data.set(projectKey(ID_A), { a: "new" });
    const keys = async () => [...from.data.keys()];
    expect(await moveAppKeys({ ...from, keys }, to)).toBe(2);
    expect(to.data.get(INDEX_KEY)).toEqual(["old-index"]);
    expect(to.data.get(projectKey(ID_A))).toEqual({ a: "new" });
    expect(to.data.get(LEGACY_AUTOSAVE_KEY)).toEqual({ legacy: true });
    expect([...from.data.keys()]).toEqual(["other-site:key"]);
    // 2 回目は何もしない
    expect(await moveAppKeys({ ...from, keys }, to)).toBe(0);
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
