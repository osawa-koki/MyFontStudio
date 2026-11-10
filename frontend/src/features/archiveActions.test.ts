import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";

// Web Worker とダウンロードを差し替える。runInWorker は resolve されるまで待つ
const mocks = vi.hoisted(() => ({
  pending: [] as {
    task: { exportCount: number };
    resolve(v: unknown): void;
    reject(e: unknown): void;
  }[],
  downloads: [] as string[],
}));
vi.mock("./worker", () => {
  class TaskCancelledError extends Error {
    constructor() {
      super("cancelled");
    }
  }
  class TaskBusyError extends Error {}
  return {
    TaskCancelledError,
    TaskBusyError,
    runInWorker: (task: { exportCount: number }) =>
      new Promise((resolve, reject) => mocks.pending.push({ task, resolve, reject })),
  };
});
vi.mock("../lib/download", () => ({
  downloadBlob: (_: Blob, name: string) => void mocks.downloads.push(name),
}));
vi.mock("./unsavedWarning", () => ({ unsavedDraftChars: () => [] }));

const { saveZip } = await import("./archiveActions");
const { TaskCancelledError } = await import("./worker");
const s = () => useProjectStore.getState();
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("saveZip", () => {
  beforeEach(() => {
    mocks.pending.length = 0;
    mocks.downloads.length = 0;
    s().newProject("Foo", "id");
    s().addChars(["a"]);
  });

  it("保存の途中の変更は「zip 未保存」に残る。書き出し回数は保存できてから加算する", async () => {
    const done = saveZip();
    await flush();
    expect(mocks.pending).toHaveLength(1);
    expect(mocks.pending[0]!.task.exportCount).toBe(1);
    expect(s().project.font.exportCount).toBe(0);
    s().addChars(["b"]); // 保存の途中の変更
    mocks.pending[0]!.resolve(new Uint8Array([1]));
    await done;
    expect(mocks.downloads).toHaveLength(1);
    expect(s().project.font.exportCount).toBe(1);
    expect(s().dirty).toBe(true);
  });

  it("プロジェクトを開いていなければ保存せずに知らせる", async () => {
    s().closeProject();
    useUiStore.setState({ toasts: [] });
    await saveZip();
    expect(mocks.pending).toHaveLength(0);
    expect(mocks.downloads).toHaveLength(0);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual([
      expect.stringMatching(/プロジェクトを開いていません/),
    ]);
  });

  it("途中で変更がなければ保存済みになる", async () => {
    const done = saveZip();
    await flush();
    mocks.pending[0]!.resolve(new Uint8Array([1]));
    await done;
    expect(s().dirty).toBe(false);
  });

  it("保存の途中に呼んでも重ねて動かさない", async () => {
    const first = saveZip();
    await flush();
    await saveZip();
    expect(mocks.pending).toHaveLength(1);
    expect(useUiStore.getState().toasts.at(-1)?.message).toContain("zip に保存しています");
    mocks.pending[0]!.resolve(new Uint8Array([1]));
    await first;
    expect(mocks.downloads).toHaveLength(1);
    // 終わったあとはまた保存できる
    const second = saveZip();
    await flush();
    expect(mocks.pending[1]!.task.exportCount).toBe(2);
    mocks.pending[1]!.resolve(new Uint8Array([1]));
    await second;
    expect(s().project.font.exportCount).toBe(2);
  });

  it("取り消し・失敗では書き出し回数を増やさず、「zip 未保存」のまま", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const error of [new TaskCancelledError(), new Error("boom")]) {
      const done = saveZip();
      await flush();
      mocks.pending.at(-1)!.reject(error);
      await done;
    }
    expect(s().project.font.exportCount).toBe(0);
    expect(s().dirty).toBe(true);
    expect(mocks.downloads).toHaveLength(0);
  });
});
