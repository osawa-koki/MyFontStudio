// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KUCHI } from "../lib/testing/fixtures";
import { useProjectStore } from "../store/projectStore";
import { useTabLockStore } from "../store/tabLockStore";
import { useUiStore } from "../store/uiStore";

// IndexedDB（idb-keyval）をメモリの Map に差し替える
const db = vi.hoisted(() => new Map<string, unknown>());
const writes = vi.hoisted(() => [] as string[][]);
vi.mock("idb-keyval", () => ({
  get: async (k: string) => structuredClone(db.get(k)),
  getMany: async (ks: string[]) => ks.map((k) => structuredClone(db.get(k))),
  set: async (k: string, v: unknown) => void db.set(k, structuredClone(v)),
  setMany: async (entries: [string, unknown][]) => {
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
  useTabLockStore.getState().set("owner");
  useUiStore.setState({ toasts: [] });
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

  it("ほかのタブで編集しているときは保存しない", async () => {
    renderHook(() => useProjectPersistence());
    const id = store().newProject("Blocked");
    useTabLockStore.getState().set("blocked");
    act(() => void store().addChars(["あ"]));
    await flushProjectSave();
    expect(db.has(projectKey(id))).toBe(false);
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
    expect(result.current).toBe("invalid");
  });

  it("保存してあれば読み込み、保存していなければ新しく始めて知らせる", async () => {
    const id = await openAsNewProject({ ...store().project, queue: ["口"], glyphs: { 口: KUCHI } });
    useProjectStore.getState().closeProject();
    nav.search = `uuid=${id}`;
    const { result } = renderHook(() => useProjectFromUrl());
    expect(result.current).toBe("loading");
    await waitFor(() => expect(result.current).toBe("ready"));
    expect(store().project.queue).toEqual(["口"]);

    const missing = "1c9f7d5f-3a2b-4d4c-8e6f-8b7c6d5e4f30";
    nav.search = `uuid=${missing}`;
    const next = renderHook(() => useProjectFromUrl());
    await waitFor(() => expect(next.result.current).toBe("ready"));
    expect(store().projectId).toBe(missing);
    expect(
      useUiStore
        .getState()
        .toasts.some((t) => t.message.includes("このブラウザに保存されていない")),
    ).toBe(true);
  });
});
