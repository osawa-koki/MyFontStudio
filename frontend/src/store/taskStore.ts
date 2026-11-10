import { create } from "zustand";

/** 画面に進み具合を出している重い処理（zip の保存・読み込み・フォントのダウンロード）。同時に動かすのは 1 つだけ */
export interface RunningTask {
  id: number;
  label: string;
  done: number;
  /** 0 なら全体の量がわからない（進み具合のバーを動かし続ける） */
  total: number;
  cancel: () => void;
}

interface TaskState {
  task: RunningTask | null;
  set(task: RunningTask | null): void;
  update(id: number, progress: { label: string; done: number; total: number }): void;
}

export const useTaskStore = create<TaskState>()((set) => ({
  task: null,
  set: (task) => set({ task }),
  update: (id, progress) =>
    set((s) => (s.task?.id === id ? { task: { ...s.task, ...progress } } : {})),
}));

/** ほかの処理が動いているときの説明（ボタンの title・通知に使う） */
export const busyMessage = (label: string) => `ほかの処理（${label}）が終わるまでお待ちください`;

/** 画面用：進み具合を出している処理が動いていれば、その説明。なければ null */
export const useBusyMessage = (): string | null =>
  useTaskStore((s) => (s.task ? busyMessage(s.task.label) : null));
