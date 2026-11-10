import { beforeEach, describe, expect, it, vi } from "vitest";
import { KUCHI } from "../lib/testing/fixtures";
import { useFontStore } from "../store/fontStore";
import { useProjectStore } from "../store/projectStore";

// Web Worker と FontFace を差し替える
const mocks = vi.hoisted(() => ({ fail: null as Error | null, registered: 0 }));
vi.mock("./worker", () => ({
  TaskCancelledError: class extends Error {},
  isUnloading: () => false,
  runInWorker: async () => {
    if (mocks.fail) throw mocks.fail;
    return new ArrayBuffer(8);
  },
}));
vi.mock("../lib/font/fontface", () => ({
  registerPreviewFont: async () => `hw-preview-${++mocks.registered}`,
  unregisterPreviewFont: () => {},
}));

const { rebuildPreviewFont } = await import("./fontPreview");
const font = () => useFontStore.getState();

describe("rebuildPreviewFont", () => {
  beforeEach(() => {
    mocks.fail = null;
    useFontStore.getState().reset();
    useProjectStore.getState().newProject("Preview");
    useProjectStore.getState().saveGlyph(KUCHI);
  });

  it("作っている途中は building、できたら ready", async () => {
    const done = rebuildPreviewFont();
    expect(font().status).toBe("building");
    await done;
    expect(font()).toMatchObject({ status: "ready", error: null, outlineCount: 1 });
    expect(font().family).toMatch(/^hw-preview-/);
    expect(font().chars.has("口")).toBe(true);
  });

  it("失敗したら error と理由。前に作ったフォントは残す（前のフォントで表示していると出すため）", async () => {
    await rebuildPreviewFont();
    const before = font().family;
    mocks.fail = new Error("壊れた");
    await rebuildPreviewFont();
    expect(font()).toMatchObject({ status: "error", error: "壊れた", family: before });
    // やり直して成功すれば戻る
    mocks.fail = null;
    await rebuildPreviewFont();
    expect(font()).toMatchObject({ status: "ready", error: null });
  });

  it("初めての生成で失敗しても、フォントはないまま error", async () => {
    mocks.fail = new Error("x");
    await rebuildPreviewFont();
    expect(font()).toMatchObject({ status: "error", family: null });
  });

  it("reset（プロジェクトを切り替えたとき）は、前のプロジェクトのフォントを使わない", async () => {
    await rebuildPreviewFont();
    font().reset();
    expect(font()).toMatchObject({ family: null, outlineCount: 0, status: "idle", error: null });
    expect(font().chars.size).toBe(0);
  });
});
