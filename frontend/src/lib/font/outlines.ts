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

/**
 * collectOutlines を、一定の時間ごとに yieldFn で処理を譲りながら行う（zip の読み込み直後など、
 * キャッシュのない輪郭をたくさん計算するときに画面を止めないため）。cancelled が true を返したら null
 */
export async function collectOutlinesAsync(
  project: Project,
  options: { yieldFn?: () => Promise<void>; sliceMs?: number; cancelled?: () => boolean } = {},
): Promise<GlyphOutline[] | null> {
  const yieldFn = options.yieldFn ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  const sliceMs = options.sliceMs ?? 12;
  const outlines: GlyphOutline[] = [];
  const seen = new Set<string>();
  let sliceStart = performance.now();
  for (const char of [...project.queue, ...Object.keys(project.glyphs)]) {
    if (seen.has(char)) continue;
    seen.add(char);
    const glyph = project.glyphs[char];
    if (!glyph || glyph.strokes.length === 0) continue;
    if (performance.now() - sliceStart > sliceMs) {
      await yieldFn();
      if (options.cancelled?.()) return null;
      sliceStart = performance.now();
    }
    const outline = getGlyphOutline(glyph);
    if (outline.contours.length > 0) outlines.push(outline);
  }
  return outlines;
}
