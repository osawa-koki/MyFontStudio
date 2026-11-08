import { create } from "zustand";

/** 画面に進み具合を出している重い処理（zip の保存・読み込みなど）。1 つだけ */
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
