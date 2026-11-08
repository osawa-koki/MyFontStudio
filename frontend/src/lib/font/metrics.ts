// フォント全体のメトリクス（仕様 6.1）。両形式で同じ値を書く
export const UNITS_PER_EM = 1000;
export const TYPO_ASCENDER = 880;
export const TYPO_DESCENDER = -120;
export const TYPO_LINE_GAP = 0;
/** はみ出した描画が欠けないよう余裕を持たせる */
export const WIN_ASCENT = 1000;
export const WIN_DESCENT = 200;
/** OS で行の高さがそろうよう usWin と同じにする */
export const HHEA_ASCENDER = WIN_ASCENT;
export const HHEA_DESCENDER = -WIN_DESCENT;
export const HHEA_LINE_GAP = 0;
export const X_HEIGHT = 500;
export const CAP_HEIGHT = 700;
export const WEIGHT_CLASS = 400;
/** fsSelection の REGULAR（bit 6） */
export const FS_SELECTION_REGULAR = 0x40;
export const UNDERLINE_POSITION = -100;
export const UNDERLINE_THICKNESS = 50;
export const VENDOR_ID = "NONE";
/** 半角スペース・全角スペースの送り幅 */
export const SPACE_ADVANCE = 300;
export const IDEOGRAPHIC_SPACE_ADVANCE = 1000;
export const NOTDEF_ADVANCE = 1000;
