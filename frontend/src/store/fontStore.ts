import { create } from "zustand";

/**
 * プレビュー用のフォントの生成の状態
 * - idle：まだ作っていない（プロジェクトを開いた直後・切り替えた直後）
 * - building：作っている途中（前に作ったフォントがあれば、それを表示している）
 * - ready：最新のグリフで作った
 * - error：作れなかった（前に作ったフォントがあれば、それを表示している）
 */
export type FontStatus = "idle" | "building" | "ready" | "error";

/** プレビュー用に生成したフォントの状態 */
interface FontState {
  /** CSS の font-family に使う名前（FontFace に登録したもの）。未生成なら null */
  family: string | null;
  /** 輪郭のあるグリフの数 */
  outlineCount: number;
  /** 作成済み（輪郭のある）文字の集合 */
  chars: ReadonlySet<string>;
  status: FontStatus;
  /** 作れなかった理由（status が error のとき） */
  error: string | null;
  set(state: Partial<Omit<FontState, "set" | "reset">>): void;
  /** プロジェクトを切り替えたとき。前のプロジェクトのフォントを使わない */
  reset(): void;
}

const EMPTY = {
  family: null,
  outlineCount: 0,
  chars: new Set<string>(),
  status: "idle" as FontStatus,
  error: null,
};

export const useFontStore = create<FontState>()((set) => ({
  ...EMPTY,
  set: (state) => set(state),
  reset: () => set({ ...EMPTY, chars: new Set() }),
}));
