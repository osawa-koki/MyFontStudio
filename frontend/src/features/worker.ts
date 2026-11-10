import { ArchiveError } from "../lib/archive/common";
import { renderOutlinePng } from "../lib/glyph/png";
import { useTaskStore } from "../store/taskStore";
import type { WorkerRequest, WorkerResponse } from "../workers/font.worker";
import type { Task, TaskResult } from "../workers/tasks";

/** 取り消したとき */
export class TaskCancelledError extends Error {
  constructor() {
    super("取り消しました");
  }
}

/** Worker が壊れた（読み込めなかった・処理の途中で落ちた） */
export class WorkerCrashedError extends Error {}

/**
 * ページを離れる途中か。再読み込み・移動の途中で Worker のファイルの読み込みが中断されると Worker のエラーになるが、
 * そのときは「取り消し」として扱う（エラーとして出さない）
 */
let unloading = false;
if (typeof window !== "undefined") {
  // WebKit は pagehide より前（移動を始めた時点）に Worker の読み込みを中断するので、beforeunload でも印を付ける
  window.addEventListener("beforeunload", () => (unloading = true));
  window.addEventListener("pagehide", () => (unloading = true));
  window.addEventListener("pageshow", () => (unloading = false));
}

/** ページを離れる途中か（このあいだは Worker を作らない。作っても読み込みが中断されるだけ） */
export const isUnloading = () => unloading;

/** Worker のファイルの URL（ファイル名は next.config.ts がビルド時に埋め込む） */
export const workerUrl = () =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/workers/${process.env.NEXT_PUBLIC_WORKER_FILE ?? "font.worker.js"}`;

/**
 * Worker を読み込めなかったとき（一度も応答しないまま失敗した）の文言。
 * デプロイのあとに古い画面を開いたままだと、古い Worker のファイルがなくなっていて読み込めない
 */
export const WORKER_LOAD_FAILED_MESSAGE =
  "処理の準備（Web Worker の読み込み）に失敗しました。アプリが更新された可能性があるので、ページを再読み込みしてください";

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
    // Next.js（Turbopack）は new Worker(new URL(...)) の TypeScript をバンドルしないため。
    // ファイル名には中身のハッシュが付く（デプロイの前に開いた画面が、新しい Worker を読み込まないように）
    worker = new Worker(workerUrl(), { type: "module" });
    let started = false;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      started = true;
      const msg = e.data;
      if (msg.type === "ready") return;
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
      // ここで処理するので、ページの未処理の例外にしない（WebKit は preventDefault しないとページの例外として出す）
      e.preventDefault();
      // Worker が壊れたら、待っている処理をすべて失敗にして、次は作り直す
      for (const p of pending.values()) {
        p.reject(
          unloading
            ? new TaskCancelledError()
            : new WorkerCrashedError(
                started
                  ? e.message || "Web Worker でエラーが起きました"
                  : WORKER_LOAD_FAILED_MESSAGE,
              ),
        );
      }
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
    // ページを離れる途中は、新しい処理を始めない（Worker の読み込みが中断され、やり直しを繰り返すことになる）
    if (unloading) throw new TaskCancelledError();
    const w = getWorker();
    if (!w) {
      // Worker が使えないときだけ読み込む（JSZip・fonteditor-core・opentype.js を画面のバンドルに入れない）
      const { runTask } = await import("../workers/tasks");
      return await runTask(task, {
        onProgress,
        renderPng: typeof document !== "undefined" ? renderOutlinePng : undefined,
      });
    }
    const send = (target: Worker) =>
      new Promise<TaskResult<T>>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
        target.postMessage({ id, task } satisfies WorkerRequest, options.transfer ?? []);
      });
    try {
      return await send(w);
    } catch (e) {
      // Worker が壊れたら、作り直して 1 回だけやり直す（渡したバッファは移していて送り直せないので、そのときはやり直さない）
      const retry = getWorker();
      if (!(e instanceof WorkerCrashedError) || options.transfer?.length || !retry) throw e;
      return await send(retry);
    }
  } finally {
    if (options.label && useTaskStore.getState().task?.id === id) useTaskStore.getState().set(null);
  }
}
