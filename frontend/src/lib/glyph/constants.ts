/** フォントの基準座標（unitsPerEm）。Canvas も 0〜1000 の正方形 */
export const EM = 1000;
/** Canvas の y=0 にあたるフォント座標（デザイン上の ascender） */
export const ASCENDER = 880;
/** Canvas の y=1000 にあたるフォント座標（デザイン上の descender） */
export const DESCENDER = -120;
/** Canvas のベースライン（フォント座標の 0） */
export const BASELINE_Y = ASCENDER;
/** 英字用のガイド（フォント座標） */
export const X_HEIGHT = 500;
export const CAP_HEIGHT = 700;
/** 推奨描画範囲の内側の余白 */
export const SAFE_MARGIN = 50;

/** 全角文字の送り幅 */
export const FULL_ADVANCE = 1000;
/** 半角文字の左右の余白と、送り幅の最小値 */
export const HALF_SIDE_BEARING = 60;
export const HALF_MIN_ADVANCE = 250;

/** 簡略化の許容誤差（足りなければ順に上げる）と、1 グリフの制御点の上限 */
export const SIMPLIFY_TOLERANCES = [0.8, 1.6, 3.2, 6.4, 12.8, 25.6] as const;
export const MAX_GLYPH_POINTS = 3000;
/** これより小さい輪郭（平方単位）は消す */
export const MIN_CONTOUR_AREA = 4;

/**
 * ストロークの点の座標の範囲（Canvas の em 座標）。枠（0〜1000）の外にはみ出した描画は保持するが（仕様 5.3）、
 * フォントの座標（16 ビット）に収まるよう、枠の外 1em までに収める。zip・ブラウザから読み込むときもこの範囲で確かめる
 */
export const STROKE_COORD_MIN = -1000;
export const STROKE_COORD_MAX = 2000;
