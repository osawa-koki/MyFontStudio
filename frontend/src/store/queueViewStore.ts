import { create } from "zustand";
import { DEFAULT_VIEW, type QueueViewOptions } from "../lib/project/queueView";

/** 文字一覧の並び替え・絞り込みの設定（画面を移動しても保つ。プロジェクトには保存しない） */
interface QueueViewState extends QueueViewOptions {
  set(options: Partial<QueueViewOptions>): void;
  /** 絞り込み（検索・状態・種類）を解除する。並び順はそのまま */
  clearFilters(): void;
}

export const useQueueViewStore = create<QueueViewState>()((set) => ({
  ...DEFAULT_VIEW,
  set: (options) => set(options),
  clearFilters: () => set({ query: "", status: "all", kind: "all" }),
}));
