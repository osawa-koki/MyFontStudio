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

/**
 * 保存してよいか。ほかのタブで編集しているとき（blocked・released）だけ保存しない。
 * pending（ページを移ってロックを取り直している途中など）は保存する（その間の変更が保存されずに残らないように）
 */
export const canEditInThisTab = () => {
  const { status } = useTabLockStore.getState();
  return status !== "blocked" && status !== "released";
};
