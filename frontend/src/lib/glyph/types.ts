/** 輪郭の 1 点（フォント座標、整数）。TrueType の二次ベジェと同じ形 */
export interface OutlinePoint {
  x: number;
  y: number;
  onCurve: boolean;
}

/** 閉じた輪郭。先頭は onCurve の点。外側は時計回り、穴は反時計回り（y 上向きで見た向き） */
export type Contour = OutlinePoint[];

/** 形式に依存しないグリフの中間データ */
export interface GlyphOutline {
  char: string;
  /** コードポイント */
  unicode: number;
  contours: Contour[];
  advanceWidth: number;
}

/** 2 次元の点（計算の途中で使う浮動小数点の座標） */
export type Vec = [number, number];
/** 閉じた多角形（先頭と末尾は同じ点にしない） */
export type Ring = Vec[];
