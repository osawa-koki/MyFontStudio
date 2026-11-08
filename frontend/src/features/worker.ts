import { ArchiveError } from "../lib/archive/common";
import { renderGlyphPng } from "../lib/glyph/png";
import { useTaskStore } from "../store/taskStore";
import type { WorkerRequest, WorkerResponse } from "../workers/font.worker";
import type { Task, TaskResult } from "../workers/tasks";

/** 取り消したとき */
export class TaskCancelledError extends Error {
  constructor() {
    super("取り消しました");
  }
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    onProgress?: (p: { label: string; done: number; total: number }) => void;
  }
>();

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    // Worker は esbuild で別にバンドルして public/workers/ に置く（npm run build:worker。build・dev の前に自動で実行する）。
    // Next.js（Turbopack）は new Worker(new URL(...)) の TypeScript をバンドルしないため
    worker = new Worker(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/workers/font.worker.js`, {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === "progress") p.onProgress?.(msg.progress);
      else {
        pending.delete(msg.id);
        if (msg.type === "done") p.resolve(msg.result);
        else p.reject(msg.archive ? new ArchiveError(msg.message) : new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      // Worker が壊れたら、待っている処理をすべて失敗にして、次は作り直す
      for (const p of pending.values())
        p.reject(new Error(e.message || "Web Worker でエラーが起きました"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/** Worker を止めて、待っている処理をすべて取り消す（次の処理で作り直す） */
function terminate(): void {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new TaskCancelledError());
  pending.clear();
}

/**
 * 重い処理を Web Worker で動かす（画面を止めない）。label を渡すと、画面に進み具合と「取り消す」を出す。
 * Worker が使えない環境では、画面のスレッドで同じ処理を動かす
 */
export async function runInWorker<T extends Task>(
  task: T,
  options: { label?: string; transfer?: Transferable[] } = {},
): Promise<TaskResult<T>> {
  const id = nextId++;
  const tasks = useTaskStore.getState();
  if (options.label) {
    tasks.set({ id, label: options.label, done: 0, total: 0, cancel: terminate });
  }
  const onProgress = options.label
    ? (p: { label: string; done: number; total: number }) => useTaskStore.getState().update(id, p)
    : undefined;
  try {
    const w = getWorker();
    if (!w) {
      // Worker が使えないときだけ読み込む（JSZip・fonteditor-core・opentype.js を画面のバンドルに入れない）
      const { runTask } = await import("../workers/tasks");
      return await runTask(task, {
        onProgress,
        renderPng: typeof document !== "undefined" ? renderGlyphPng : undefined,
      });
    }
    return await new Promise<TaskResult<T>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      w.postMessage({ id, task } satisfies WorkerRequest, options.transfer ?? []);
    });
  } finally {
    if (options.label && useTaskStore.getState().task?.id === id) useTaskStore.getState().set(null);
  }
}
