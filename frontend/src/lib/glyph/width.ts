import { eastAsianWidthType } from "get-east-asian-width";
import type { WidthMode } from "../../types/project";
import { FULL_ADVANCE, HALF_MIN_ADVANCE, HALF_SIDE_BEARING } from "./constants";
import type { Contour } from "./types";

/**
 * East Asian Width が W・F・A なら全角。
 * ただし A のうちラテン文字（é など）は半角にする（ñ などの N と幅をそろえるため。× ÷ ° などの記号は全角のまま）
 */
export function isFullWidthChar(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  const t = eastAsianWidthType(cp);
  if (t === "ambiguous") return !/\p{Script=Latin}/u.test(char);
  return t === "wide" || t === "fullwidth";
}

export function isFullWidth(char: string, widthMode: WidthMode): boolean {
  if (widthMode === "full") return true;
  if (widthMode === "half") return false;
  return isFullWidthChar(char);
}

export function contoursBounds(
  contours: readonly Contour[],
): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      xMin = Math.min(xMin, p.x);
      yMin = Math.min(yMin, p.y);
      xMax = Math.max(xMax, p.x);
      yMax = Math.max(yMax, p.y);
    }
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/**
 * 送り幅を決める（仕様 6.2）
 * - 全角：1000 固定、描いた位置のまま
 * - 半角：描画の左端が x=60 になるよう平行移動し、幅＋120 を送り幅にする。
 *   250 に満たなければ 250 にして、描画を中央に置く
 */
export function layoutGlyph(
  contours: Contour[],
  char: string,
  widthMode: WidthMode,
): { contours: Contour[]; advanceWidth: number } {
  if (isFullWidth(char, widthMode)) return { contours, advanceWidth: FULL_ADVANCE };
  const bounds = contoursBounds(contours);
  if (!bounds) return { contours, advanceWidth: HALF_MIN_ADVANCE };
  const width = bounds.xMax - bounds.xMin;
  let advanceWidth = width + HALF_SIDE_BEARING * 2;
  let dx = HALF_SIDE_BEARING - bounds.xMin;
  if (advanceWidth < HALF_MIN_ADVANCE) {
    advanceWidth = HALF_MIN_ADVANCE;
    dx = Math.round((HALF_MIN_ADVANCE - width) / 2) - bounds.xMin;
  }
  return {
    contours: dx === 0 ? contours : contours.map((c) => c.map((p) => ({ ...p, x: p.x + dx }))),
    advanceWidth,
  };
}
