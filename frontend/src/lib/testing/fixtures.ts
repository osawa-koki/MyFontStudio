// テスト用の手書きデータ（固定のストローク）
import type { GlyphData, Stroke, StrokePoint, WidthMode } from "../../types/project";
import { toCodepointLabel } from "../project/project";

/** (x0, y0) から (x1, y1) までの直線のストローク（step ごとに点を打つ） */
export function line(x0: number, y0: number, x1: number, y1: number, step = 10): Stroke {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  const points: StrokePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push([
      Math.round((x0 + (x1 - x0) * t) * 10) / 10,
      Math.round((y0 + (y1 - y0) * t) * 10) / 10,
      0.5,
    ]);
  }
  return { points };
}

/** タップだけの点 */
export function dot(x: number, y: number): Stroke {
  return { points: [[x, y, 0.5]] };
}

export function makeGlyph(
  char: string,
  strokes: Stroke[],
  widthMode: WidthMode = "auto",
): GlyphData {
  return {
    char,
    codepoint: toCodepointLabel(char),
    canvasSize: 1000,
    widthMode,
    pen: { size: 40, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false },
    strokes,
    updatedAt: "2026-11-08T12:00:00+09:00",
  };
}

/** 「口」：4 本の線で囲んだ四角（穴が 1 つ） */
export const KUCHI = makeGlyph("口", [
  line(250, 250, 750, 250),
  line(750, 250, 750, 750),
  line(750, 750, 250, 750),
  line(250, 750, 250, 250),
]);

/** 「十」：交差する 2 本 */
export const JUU = makeGlyph("十", [line(150, 450, 850, 450), line(500, 100, 500, 850)]);

/** 「。」：小さな円の点 */
export const MARU = makeGlyph("。", [dot(200, 800)]);

/** 「A」：半角 */
export const LATIN_A = makeGlyph("A", [
  line(300, 860, 500, 200),
  line(500, 200, 700, 860),
  line(380, 600, 620, 600),
]);
