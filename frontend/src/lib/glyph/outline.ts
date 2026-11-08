import { getStroke } from "perfect-freehand";
import polygonClipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
import type { GlyphData, GlyphPen, Stroke } from "../../types/project";
import { ASCENDER, MAX_GLYPH_POINTS, MIN_CONTOUR_AREA, SIMPLIFY_TOLERANCES } from "./constants";
import { normalizeRing, signedArea, simplifyRing } from "./geometry";
import type { Contour, GlyphOutline, OutlinePoint, Ring, Vec } from "./types";
import { layoutGlyph } from "./width";

/** perfect-freehand に渡すオプション */
export function strokeOptions(stroke: Stroke, pen: GlyphPen) {
  return {
    size: pen.size,
    thinning: pen.thinning,
    smoothing: pen.smoothing,
    streamline: pen.streamline,
    simulatePressure: stroke.simulatePressure ?? pen.simulatePressure,
    last: true,
  };
}

/**
 * 手順 2：1 本のストロークを太さ付きの輪郭（Canvas 座標の多角形）にする。
 * 点が 1 つだけ（タップ）のときは円になる
 */
export function strokeToRing(stroke: Stroke, pen: GlyphPen): Ring {
  if (stroke.points.length === 0) return [];
  const outline = getStroke(stroke.points, strokeOptions(stroke, pen));
  return normalizeRing(outline.map((p) => [p[0]!, p[1]!] as Vec));
}

/**
 * 手順 3：全ストロークを合成する。polygon-clipping が失敗したときは合成せずに
 * それぞれの輪郭をそのまま使う（nonzero で塗れば見た目は同じ）
 */
export function unionRings(rings: readonly Ring[]): MultiPolygon {
  const polys: Polygon[] = rings.filter((r) => r.length >= 3).map((r) => [r]);
  if (polys.length === 0) return [];
  try {
    const [first, ...rest] = polys;
    return polygonClipping.union(first!, ...rest);
  } catch (e) {
    console.warn("ストロークの合成に失敗したため、合成せずに使います", e);
    return polys;
  }
}

/** Canvas 座標（y 下向き）→ フォント座標（y 上向き、ベースライン 0） */
export function toFontCoords(ring: readonly Vec[]): Ring {
  return ring.map(([x, y]) => [x, ASCENDER - y]);
}

/** 向きをそろえる。clockwise なら時計回り（y 上向きで符号付き面積が負）にする */
export function orientRing(ring: Ring, clockwise: boolean): Ring {
  const isClockwise = signedArea(ring) < 0;
  return isClockwise === clockwise ? ring : ring.slice().reverse();
}

/**
 * 手順 5：多角形を、隣り合う点の中点を onCurve、元の点を offCurve とする二次ベジェの輪郭にする。
 * 座標は整数に丸め、丸めて重なった点は取り除く
 */
export function ringToQuadratic(ring: readonly Vec[]): Contour {
  const n = ring.length;
  const raw: OutlinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    raw.push({ x: Math.round((p[0] + q[0]) / 2), y: Math.round((p[1] + q[1]) / 2), onCurve: true });
    raw.push({ x: Math.round(q[0]), y: Math.round(q[1]), onCurve: false });
  }
  return dedupeContour(raw);
}

const samePoint = (a: OutlinePoint, b: OutlinePoint) => a.x === b.x && a.y === b.y;

/**
 * 丸めで同じ位置になった点を整理する。
 * - offCurve が隣の onCurve と同じ位置 → offCurve を消す（直線になる）
 * - 連続する onCurve が同じ位置 → 1 つにする
 */
export function dedupeContour(points: readonly OutlinePoint[]): Contour {
  let pts = points.slice();
  let changed = true;
  while (changed && pts.length > 0) {
    changed = false;
    const out: OutlinePoint[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const prev = out[out.length - 1] ?? pts[pts.length - 1]!;
      const next = pts[(i + 1) % pts.length]!;
      if (
        !p.onCurve &&
        ((prev.onCurve && samePoint(p, prev)) || (next.onCurve && samePoint(p, next)))
      ) {
        changed = true;
        continue;
      }
      if (p.onCurve && out.length > 0 && prev.onCurve && samePoint(p, prev)) {
        changed = true;
        continue;
      }
      out.push(p);
    }
    // 末尾と先頭が同じ onCurve なら末尾を消す
    while (
      out.length > 1 &&
      out[0]!.onCurve &&
      out[out.length - 1]!.onCurve &&
      samePoint(out[0]!, out[out.length - 1]!)
    ) {
      out.pop();
      changed = true;
    }
    pts = out;
  }
  // 先頭を onCurve にする
  const firstOn = pts.findIndex((p) => p.onCurve);
  if (firstOn > 0) pts = [...pts.slice(firstOn), ...pts.slice(0, firstOn)];
  return pts;
}

/** 1 つの輪郭を簡略化・座標変換・向きの正規化・曲線化する。小さすぎれば null */
function ringToContour(
  rawRing: readonly Vec[],
  tolerance: number,
  isOuter: boolean,
): Contour | null {
  const ring = simplifyRing(normalizeRing(rawRing), tolerance);
  if (ring.length < 3 || Math.abs(signedArea(ring)) < MIN_CONTOUR_AREA) return null;
  const contour = ringToQuadratic(orientRing(toFontCoords(ring), isOuter));
  return contour.length >= 3 ? contour : null;
}

/** 手順 4〜7：合成した多角形から輪郭を作る。外側が消えたときは、その穴も使わない */
export function polygonsToContours(polygons: MultiPolygon, tolerance: number): Contour[] {
  const contours: Contour[] = [];
  for (const [outer, ...holes] of polygons) {
    if (!outer) continue;
    const outerContour = ringToContour(outer as Vec[], tolerance, true);
    if (!outerContour) continue;
    contours.push(outerContour);
    for (const hole of holes) {
      const c = ringToContour(hole as Vec[], tolerance, false);
      if (c) contours.push(c);
    }
  }
  return contours;
}

export function countPoints(contours: readonly Contour[]): number {
  return contours.reduce((n, c) => n + c.length, 0);
}

/** グリフの手書きデータから、形式に依存しない輪郭（GlyphOutline）を作る。同じ入力なら必ず同じ結果になる */
export function glyphToOutline(glyph: GlyphData): GlyphOutline {
  const rings = glyph.strokes.map((s) => strokeToRing(s, glyph.pen));
  const polygons = unionRings(rings);
  let contours: Contour[] = [];
  for (const tolerance of SIMPLIFY_TOLERANCES) {
    contours = polygonsToContours(polygons, tolerance);
    if (countPoints(contours) <= MAX_GLYPH_POINTS) break;
  }
  const laid = layoutGlyph(contours, glyph.char, glyph.widthMode);
  return {
    char: glyph.char,
    unicode: glyph.char.codePointAt(0)!,
    contours: laid.contours,
    advanceWidth: laid.advanceWidth,
  };
}

const outlineCache = new WeakMap<GlyphData, GlyphOutline>();

/** glyphToOutline の結果をグリフのオブジェクトごとにキャッシュする（保存のたびにオブジェクトが変わる） */
export function getGlyphOutline(glyph: GlyphData): GlyphOutline {
  let outline = outlineCache.get(glyph);
  if (!outline) {
    outline = glyphToOutline(glyph);
    outlineCache.set(glyph, outline);
  }
  return outline;
}
