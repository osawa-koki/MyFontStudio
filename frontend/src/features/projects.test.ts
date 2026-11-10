// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KUCHI } from "../lib/testing/fixtures";
import { useProjectStore } from "../store/projectStore";
import { useSaveStatusStore } from "../store/saveStatusStore";
import { useTabLockStore } from "../store/tabLockStore";
import { useUiStore } from "../store/uiStore";

// IndexedDB（idb-keyval）をメモリの Map に差し替える
const db = vi.hoisted(() => new Map<string, unknown>());
const writes = vi.hoisted(() => [] as string[][]);
// setMany を失敗させる（容量の不足などのテスト）
const failure = vi.hoisted(() => ({ error: null as Error | null }));
vi.mock("idb-keyval", () => ({
  get: async (k: string) => structuredClone(db.get(k)),
  getMany: async (ks: string[]) => ks.map((k) => structuredClone(db.get(k))),
  set: async (k: string, v: unknown) => void db.set(k, structuredClone(v)),
  setMany: async (entries: [string, unknown][]) => {
    if (failure.error) throw failure.error;
    writes.push(entries.map(([k]) => k));
    entries.forEach(([k, v]) => db.set(k, structuredClone(v)));
  },
  del: async (k: string) => void db.delete(k),
  delMany: async (ks: string[]) => ks.forEach((k) => db.delete(k)),
}));

// next/navigation の URL を差し替える
// Next.js と同じく、ルーターは描画のたびに同じオブジェクトを返す
const nav = vi.hoisted(() => {
  const state = { search: "", replaced: [] as string[] };
  const router = { replace: (url: string) => void state.replaced.push(url), push: () => {} };
  return Object.assign(state, { router });
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/editor/",
  useRouter: () => nav.router,
}));

const {
  deleteStoredProject,
  flushProjectSave,
  hasPendingSave,
  listStoredProjects,
  openAsNewProject,
  reloadProject,
  saveCurrentProjectNow,
  useProjectFromUrl,
  useProjectPersistence,
} = await import("./projects");
const { loadProject, projectKey, drawingKey, glyphKey, INDEX_KEY } =
  await import("../lib/projects/repository");

const kv = {
  get: async (k: string) => db.get(k),
  getMany: async (ks: string[]) => ks.map((k) => db.get(k)),
  set: async () => {},
  setMany: async () => {},
  del: async () => {},
  delMany: async () => {},
};
const store = () => useProjectStore.getState();
const stroke = { points: [[1, 1, 0.5]] as [number, number, number][] };

beforeEach(() => {
  writes.length = 0;
  nav.search = "";
  nav.replaced.length = 0;
  // Web Locks API のない環境と同じく、いつも保存できる（ロックのテストでは個別に変える）
  useTabLockStore.getState().set("unsupported", null);
  useUiStore.setState({ toasts: [] });
  failure.error = null;
  useSaveStatusStore.getState().set({ failed: false, quota: false });
});
afterEach(async () => {
  await flushProjectSave();
  vi.useRealTimers();
});

describe("useProjectPersistence", () => {
  it("文字の追加・描いた線はすぐ、文章は待ってまとめて保存する。変わった文字だけ書く", async () => {
    const { unmount } = renderHook(() => useProjectPersistence());
    const id = store().newProject("Persist");
    // 中身のない新しいプロジェクトは保存しない
    act(() => store().setPreviewText("x"));
    await flushProjectSave();
    expect(db.has(projectKey(id))).toBe(false);

    act(() => void store().addChars(["口", "十"]));
    await flushProjectSave();
    expect((await loadProject(kv, id))!.project.queue).toEqual(["口", "十"]);

    act(() => store().saveGlyph(KUCHI));
    await flushProjectSave();
    writes.length = 0;
    act(() =>
      store().updateDrawing("十", (h) => ({
        ops: [...h.ops, { type: "add", stroke }],
        position: h.position + 1,
      })),
    );
    await flushProjectSave();
    // 描いた線の変更は「十」の履歴とメタデータ・一覧だけを書く
    expect(writes).toEqual([[drawingKey(id, "十"), projectKey(id), INDEX_KEY]]);

    // 文章は待つ（その間は保存の途中）
    act(() => store().setPreviewText("口十"));
    expect(hasPendingSave()).toBe(true);
    await flushProjectSave();
    expect(hasPendingSave()).toBe(false);
    expect((await loadProject(kv, id))!.project.previewText).toBe("口十");
    unmount();
  });

  it("ペンの太さのスライダーを続けて動かしても、待ってから 1 回だけ書く", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useProjectPersistence());
    const id = store().newProject("Slider");
    act(() => void store().addChars(["口"]));
    await vi.advanceTimersByTimeAsync(0);
    await flushProjectSave();
    writes.length = 0;
    for (let size = 41; size <= 80; size++) {
      act(() => store().setDefaults({ pen: { ...store().project.defaults.pen, size } }));
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(writes).toEqual([]);
    expect(hasPendingSave()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    await flushProjectSave();
    expect(writes).toHaveLength(1);
    expect((await loadProject(kv, id))!.project.defaults.pen.size).toBe(80);
    unmount();
  });

  it("ロックが取れるまで（pending）は保存せず、取れたらその間の変更を保存する。別のプロジェクトのロックでは保存しない", async () => {
    const { unmount } = renderHook(() => useProjectPersistence());
    const lock = useTabLockStore.getState();
    lock.set("owner", "00000000-0000-4000-8000-000000000000");
    const id = store().newProject("Pending");
    act(() => void store().addChars(["口"]));
    await flushProjectSave();
    expect(db.has(projectKey(id))).toBe(false);
    act(() => lock.set("pending", id));
    act(() => void store().addChars(["十"]));
    await flushProjectSave();
    expect(db.has(projectKey(id))).toBe(false);
    act(() => lock.set("owner", id));
    await flushProjectSave();
    expect((await loadProject(kv, id))!.project.queue).toEqual(["口", "十"]);
    unmount();
  });

  it("待っている保存は、書く時点でロックを持っていなければ書かない", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useProjectPersistence());
    const id = store().newProject("Later");
    useTabLockStore.getState().set("owner", id);
    act(() => void store().addChars(["口"]));
    await flushProjectSave();
    act(() => store().setPreviewText("ほかのタブに渡す前の文章"));
    // 500ms 待っている間に、ほかのタブに引き継いだ
    act(() => useTabLockStore.getState().set("released", id));
    await vi.advanceTimersByTimeAsync(1000);
    await flushProjectSave();
    expect((await loadProject(kv, id))!.project.previewText).toBe("");
    unmount();
  });

  it("ほかのタブで編集しているときは保存しない", async () => {
    renderHook(() => useProjectPersistence());
    const id = store().newProject("Blocked");
    useTabLockStore.getState().set("blocked");
    act(() => void store().addChars(["あ"]));
    await flushProjectSave();
    expect(db.has(projectKey(id))).toBe(false);
  });
});

describe("保存の失敗", () => {
  const toasts = () => useUiStore.getState().toasts.map((t) => [t.kind, t.message]);

  it("失敗したら 1 回だけ知らせ、保存できていないあいだは警告する。成功したら戻して知らせる", async () => {
    const { unmount } = renderHook(() => useProjectPersistence());
    const id = store().newProject("Fail");
    failure.error = new Error("書けない");
    act(() => void store().addChars(["口"]));
    await flushProjectSave();
    act(() => void store().addChars(["十"]));
    await flushProjectSave();
    expect(useSaveStatusStore.getState()).toMatchObject({ failed: true, quota: false });
    expect(hasPendingSave()).toBe(true);
    expect(toasts()).toEqual([
      ["error", expect.stringMatching(/保存できませんでした.*zip で保存/)],
    ]);

    // 容量の不足に変わったら、改めて知らせる
    failure.error = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    act(() => void store().addChars(["日"]));
    await flushProjectSave();
    expect(useSaveStatusStore.getState().quota).toBe(true);
    expect(toasts()[1]).toEqual(["error", expect.stringMatching(/容量が足りない/)]);

    failure.error = null;
    act(() => void store().addChars(["本"]));
    await flushProjectSave();
    expect(useSaveStatusStore.getState()).toMatchObject({ failed: false, quota: false });
    expect(hasPendingSave()).toBe(false);
    expect(toasts()[2]).toEqual(["success", "ブラウザに保存できるようになりました"]);
    // 失敗していたあいだの変更も、次の保存でまとめて書かれる
    expect((await loadProject(kv, id))!.project.queue).toEqual(["口", "十", "日", "本"]);
    unmount();
  });
});

describe("保存・一覧・削除・読み直し", () => {
  it("新しく作ったものは空でも一覧に出す。削除すると閉じて消える", async () => {
    const id = store().newProject("Empty");
    await saveCurrentProjectNow();
    expect((await listStoredProjects()).some((p) => p.id === id)).toBe(true);
    await deleteStoredProject(id);
    expect(store().projectId).toBeNull();
    expect((await listStoredProjects()).some((p) => p.id === id)).toBe(false);
  });

  it("zip から読み込んだものは新しい uuid で保存して開く。reloadProject は保存されている最新の内容で開き直す", async () => {
    const p = { ...store().project, queue: ["口"], glyphs: { 口: KUCHI } };
    const id = await openAsNewProject(p);
    expect(store().projectId).toBe(id);
    expect(db.has(glyphKey(id, "口"))).toBe(true);
    // ほかのタブで書かれた内容を読み直す
    const other = (await loadProject(kv, id))!.project;
    db.set(projectKey(id), {
      ...(db.get(projectKey(id)) as object),
      project: { ...other, glyphs: undefined, drawings: undefined, queue: ["口", "新"] },
    });
    await reloadProject(id);
    expect(store().project.queue).toEqual(["口", "新"]);
  });
});

describe("useProjectFromUrl", () => {
  it("uuid がなければ、開いているプロジェクト（なければ新しいプロジェクト）の uuid を付ける", async () => {
    useProjectStore.setState({ projectId: null });
    renderHook(() => useProjectFromUrl());
    await waitFor(() => expect(nav.replaced).toHaveLength(1));
    expect(nav.replaced[0]).toBe(`/editor/?uuid=${store().projectId}`);
  });

  it("uuid の形が正しくなければ invalid", () => {
    nav.search = "uuid=../x";
    const { result } = renderHook(() => useProjectFromUrl());
    expect(result.current).toEqual({ state: "invalid" });
  });

  it("保存してあるのに読めなければ、空のプロジェクトとして開かず、元のデータを上書きしない", async () => {
    const { unmount } = renderHook(() => useProjectPersistence());
    const id = await openAsNewProject({ ...store().project, queue: ["口"], glyphs: { 口: KUCHI } });
    useProjectStore.getState().closeProject();
    // 新しい版の形式で保存されている（デプロイの前に開いた画面など）
    const meta = db.get(projectKey(id)) as Record<string, unknown>;
    db.set(projectKey(id), { ...meta, version: 99 });
    nav.search = `uuid=${id}`;
    const { result } = renderHook(() => useProjectFromUrl());
    await waitFor(() => expect(result.current).toEqual({ state: "unreadable", reason: "newer" }));
    expect(store().projectId).toBeNull();
    // 何か操作しても、そのプロジェクトのキーには書き込まない
    act(() => void store().addChars(["十"]));
    await flushProjectSave();
    expect((db.get(projectKey(id)) as { version: number }).version).toBe(99);
    expect(db.has(glyphKey(id, "口"))).toBe(true);
    unmount();
  });

  it("保存してあれば読み込み、保存していなければ新しく始めて知らせる", async () => {
    const id = await openAsNewProject({ ...store().project, queue: ["口"], glyphs: { 口: KUCHI } });
    useProjectStore.getState().closeProject();
    nav.search = `uuid=${id}`;
    const { result } = renderHook(() => useProjectFromUrl());
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toEqual({ state: "ready" }));
    expect(store().project.queue).toEqual(["口"]);

    const missing = "1c9f7d5f-3a2b-4d4c-8e6f-8b7c6d5e4f30";
    nav.search = `uuid=${missing}`;
    const next = renderHook(() => useProjectFromUrl());
    await waitFor(() => expect(next.result.current).toEqual({ state: "ready" }));
    expect(store().projectId).toBe(missing);
    expect(
      useUiStore
        .getState()
        .toasts.some((t) => t.message.includes("このブラウザに保存されていない")),
    ).toBe(true);
  });
});
