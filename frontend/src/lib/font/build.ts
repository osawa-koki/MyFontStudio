import type { GlyphOutline } from "../glyph/types";
import type { FontSettings } from "../../types/project";
import { buildFontGlyphs } from "./glyphs";
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
  return format === "ttf" ? buildTtf(spec, glyphs) : buildOtf(spec, glyphs);
}
