import { create } from "zustand";

/**
 * このタブが、開いているプロジェクトを編集できるか（同じプロジェクトを編集できるタブは 1 つだけ）
 * - unsupported：Web Locks API がない（確かめられないので、いつも編集できる）
 * - pending：確かめている・引き継いでいる途中
 * - owner：このタブで編集している
 * - blocked：ほかのタブで編集している（あとから開いた）
 * - released：ほかのタブに引き継いだ（このタブでは編集を止めた）
 */
export type TabLockStatus = "unsupported" | "pending" | "owner" | "blocked" | "released";

interface TabLockState {
  status: TabLockStatus;
  set(status: TabLockStatus): void;
}

export const useTabLockStore = create<TabLockState>()((set) => ({
  status: "pending",
  set: (status) => set({ status }),
}));

/** 保存してよいか（編集しているタブか） */
export const canEditInThisTab = () => {
  const { status } = useTabLockStore.getState();
  return status === "owner" || status === "unsupported";
};
