// 重い処理（フォントの生成・zip の保存と読み込み）を動かす Web Worker
import { ArchiveError } from "../lib/archive/archive";
import { renderGlyphPng } from "../lib/glyph/png";
import { runTask, type Progress, type Task } from "./tasks";

export type WorkerRequest = { id: number; task: Task };
export type WorkerResponse =
  | { id: number; type: "progress"; progress: Progress }
  | { id: number; type: "done"; result: unknown }
  | { id: number; type: "error"; message: string; archive: boolean };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

ctx.onmessage = async (e) => {
  const { id, task } = e.data;
  try {
    const result = await runTask(task, {
      onProgress: (progress) => ctx.postMessage({ id, type: "progress", progress }),
      renderPng: typeof OffscreenCanvas !== "undefined" ? renderGlyphPng : undefined,
    });
    // 大きなバイナリは複製せずに渡す
    const transfer =
      result instanceof ArrayBuffer
        ? [result]
        : result instanceof Uint8Array
          ? [result.buffer]
          : [];
    ctx.postMessage({ id, type: "done", result }, transfer as Transferable[]);
  } catch (err) {
    ctx.postMessage({
      id,
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      archive: err instanceof ArchiveError,
    });
  }
};
