import { getGlyphOutline } from "../glyph/outline";
import type { GlyphOutline } from "../glyph/types";
import type { Project } from "../../types/project";
import { buildFontGlyphs } from "./glyphs";
import { buildOtf } from "./otf";
import { createFontSpec } from "./spec";
import { buildTtf } from "./ttf";

export type FontFormat = "ttf" | "otf";

/** プロジェクトの作成済みグリフの輪郭（一覧の順、輪郭のないものは除く）。輪郭はグリフ単位でキャッシュする */
export function collectOutlines(project: Project): GlyphOutline[] {
  const outlines: GlyphOutline[] = [];
  const seen = new Set<string>();
  const chars = [...project.queue, ...Object.keys(project.glyphs)];
  for (const char of chars) {
    if (seen.has(char)) continue;
    seen.add(char);
    const glyph = project.glyphs[char];
    if (!glyph || glyph.strokes.length === 0) continue;
    const outline = getGlyphOutline(glyph);
    if (outline.contours.length > 0) outlines.push(outline);
  }
  return outlines;
}

/**
 * フォントを書き出す。lib/font の入口（GlyphOutline[] とフォントの設定を受け取り、ArrayBuffer を返す）。
 * 輪郭のあるグリフが 0 個なら null
 */
export function buildFont(
  format: FontFormat,
  outlines: readonly GlyphOutline[],
  font: Project["font"],
  now: Date = new Date(),
): ArrayBuffer | null {
  if (outlines.length === 0) return null;
  const spec = createFontSpec(font, now);
  const glyphs = buildFontGlyphs(outlines);
  return format === "ttf" ? buildTtf(spec, glyphs) : buildOtf(spec, glyphs);
}
