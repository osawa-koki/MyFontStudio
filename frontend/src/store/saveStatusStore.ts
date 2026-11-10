import { create } from "zustand";

/**
 * ブラウザ（IndexedDB）への保存の状態。保存に失敗しているあいだは failed（ヘッダーに出し、タブを閉じる前に警告する）。
 * quota：容量が足りないための失敗か
 */
interface SaveStatusState {
  failed: boolean;
  quota: boolean;
  set(state: { failed: boolean; quota: boolean }): void;
}

export const useSaveStatusStore = create<SaveStatusState>()((set) => ({
  failed: false,
  quota: false,
  set: (state) => set(state),
}));
