import type { Project } from "../../types/project";
import { getGlyphOutline } from "../glyph/outline";
import type { GlyphOutline } from "../glyph/types";

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
