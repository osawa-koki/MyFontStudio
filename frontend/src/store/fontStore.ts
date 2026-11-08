import { create } from "zustand";

/** プレビュー用に生成したフォントの状態 */
interface FontState {
  /** CSS の font-family に使う名前（FontFace に登録したもの）。未生成なら null */
  family: string | null;
  /** 輪郭のあるグリフの数（0 ならダウンロードできない） */
  outlineCount: number;
  /** 作成済み（輪郭のある）文字の集合 */
  chars: ReadonlySet<string>;
  error: string | null;
  set(state: Partial<Omit<FontState, "set">>): void;
}

export const useFontStore = create<FontState>()((set) => ({
  family: null,
  outlineCount: 0,
  chars: new Set(),
  error: null,
  set: (state) => set(state),
}));
