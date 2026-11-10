import { create } from "zustand";

/**
 * このタブが、開いているプロジェクトを編集できるか（同じプロジェクトを編集できるタブは 1 つだけ）
 * - unsupported：Web Locks API がない（確かめられないので、いつも編集できる）
 * - pending：プロジェクトを開いてロックを確かめている途中（すぐに終わる。まだ保存しない。ロックが取れたら、その間の変更を保存する）
 * - takeover：「このタブで編集する」で、ほかのタブの編集を止めてもらっている途中（編集画面を出さない。読み直すまで古い内容のため）
 * - owner：このタブで編集している
 * - blocked：ほかのタブで編集している（あとから開いた）
 * - released：ほかのタブに引き継いだ（このタブでは編集を止めた）
 */
export type TabLockStatus =
  "unsupported" | "pending" | "takeover" | "owner" | "blocked" | "released";

interface TabLockState {
  status: TabLockStatus;
  /** status がどのプロジェクトについてのものか（プロジェクトを切り替えた直後に、前のプロジェクトのロックで保存しないように） */
  projectId: string | null;
  /** projectId を省略すると、今のプロジェクトのまま状態だけを変える */
  set(status: TabLockStatus, projectId?: string | null): void;
  /**
   * 引き継ぎを頼んだが、ほかのタブが応答せずロックを取れなかったプロジェクト（もう一度試すかを出す）。
   * プロジェクトごとに持つ（別のプロジェクトを開いたときに、まだ試していないのに出さないように）
   */
  takeoverFailedId: string | null;
  setTakeoverFailed(projectId: string | null): void;
}

export const useTabLockStore = create<TabLockState>()((set) => ({
  status: "pending",
  projectId: null,
  set: (status, projectId) =>
    set((s) => ({ status, projectId: projectId === undefined ? s.projectId : projectId })),
  takeoverFailedId: null,
  setTakeoverFailed: (takeoverFailedId) => set({ takeoverFailedId }),
}));

/**
 * このプロジェクトを、このタブで保存してよいか。ロックを持っている（owner）ときだけ。
 * Web Locks API がなければ確かめられないので、いつも保存する
 */
export const canEditInThisTab = (projectId: string | null): boolean => {
  const { status, projectId: locked } = useTabLockStore.getState();
  if (status === "unsupported") return true;
  return status === "owner" && projectId !== null && locked === projectId;
};

/** ほかのタブで編集しているので、このタブではプロジェクトを変える操作（設定・書き出しなど）をさせないか */
export const isLockedOut = (): boolean => {
  const { status } = useTabLockStore.getState();
  return status === "blocked" || status === "released" || status === "takeover";
};

/** 画面用：isLockedOut */
export const useLockedOut = (): boolean =>
  useTabLockStore(
    (s) => s.status === "blocked" || s.status === "released" || s.status === "takeover",
  );

/** ほかのタブで編集しているときの説明（ボタンの title などに使う） */
export const LOCKED_OUT_MESSAGE =
  "このプロジェクトはほかのタブで編集しています。このタブで使うには「このタブで編集する」を押してください";

/** このプロジェクトで、引き継ぎを頼んだがほかのタブが応答しなかったか（ほかのプロジェクトの失敗では true にしない） */
export const takeoverFailedFor = (
  state: Pick<TabLockState, "takeoverFailedId">,
  projectId: string | null,
): boolean => projectId !== null && state.takeoverFailedId === projectId;
