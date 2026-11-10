import type { GlyphOutline } from "../glyph/types";
import type { FontSettings } from "../../types/project";
import { buildFontGlyphs, type FontGlyph } from "./glyphs";
import { buildOtf } from "./otf";
import { createFontSpec } from "./spec";
import { buildTtf } from "./ttf";

export type FontFormat = "ttf" | "otf";
export { collectOutlines } from "./outlines";

/**
 * フォントを書き出す。lib/font の入口（GlyphOutline[] とフォントの設定を受け取り、ArrayBuffer を返す）。
 * 輪郭のあるグリフが 0 個なら null
 */
export function buildFont(
  format: FontFormat,
  outlines: readonly GlyphOutline[],
  font: FontSettings,
  now: Date = new Date(),
): ArrayBuffer | null {
  if (outlines.length === 0) return null;
  const spec = createFontSpec(font, now);
  const glyphs = buildFontGlyphs(outlines);
  assertFontRange(glyphs);
  return format === "ttf" ? buildTtf(spec, glyphs) : buildOtf(spec, glyphs);
}

/** フォントの座標（glyf・head・hhea は 16 ビットの符号付き整数）と送り幅（16 ビットの符号なし整数）の範囲 */
const INT16_MIN = -32768;
const INT16_MAX = 32767;
const UINT16_MAX = 65535;

/**
 * 輪郭の座標と送り幅が、フォントのテーブルに書ける範囲に収まっているかを確かめる。
 * 収まらない値は書き出すときに黙って折り返され、壊れたフォントになるので、どの文字かが分かるエラーにする
 */
export function assertFontRange(glyphs: readonly FontGlyph[]): void {
  for (const g of glyphs) {
    const label = g.unicode === null ? g.name : String.fromCodePoint(g.unicode);
    if (!Number.isInteger(g.advanceWidth) || g.advanceWidth < 0 || g.advanceWidth > UINT16_MAX) {
      throw new Error(`「${label}」の送り幅がフォントで扱える範囲を超えています`);
    }
    for (const c of g.contours) {
      for (const p of c) {
        if (p.x < INT16_MIN || p.x > INT16_MAX || p.y < INT16_MIN || p.y > INT16_MAX) {
          throw new Error(`「${label}」の座標がフォントで扱える範囲を超えています`);
        }
      }
    }
  }
}
