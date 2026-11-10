// 重い処理（フォントの生成・zip の保存と読み込み）を動かす Web Worker
import { ArchiveError } from "../lib/archive/archive";
import { renderOutlinePng } from "../lib/glyph/png";
import { runTask, type Progress, type Task } from "./tasks";

export type WorkerRequest = { id: number; task: Task };
export type WorkerResponse =
  /** 読み込めた（画面で、読み込みの失敗と処理の途中の失敗を見分ける） */
  | { id: 0; type: "ready" }
  | { id: number; type: "progress"; progress: Progress }
  | { id: number; type: "done"; result: unknown }
  | { id: number; type: "error"; message: string; archive: boolean };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

ctx.postMessage({ id: 0, type: "ready" });

ctx.onmessage = async (e) => {
  const { id, task } = e.data;
  try {
    const result = await runTask(task, {
      onProgress: (progress) => ctx.postMessage({ id, type: "progress", progress }),
      renderPng: typeof OffscreenCanvas !== "undefined" ? renderOutlinePng : undefined,
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
