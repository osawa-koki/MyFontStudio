import polygonClipping from "polygon-clipping";
import { orientRing } from "../glyph/outline";
import type { Contour, GlyphOutline, Ring, Vec } from "../glyph/types";
import { normalizeRing } from "../glyph/geometry";
import { IDEOGRAPHIC_SPACE_ADVANCE, NOTDEF_ADVANCE, SPACE_ADVANCE } from "./metrics";

/** フォントに入れるグリフ（.notdef・スペースを含む）。形式ごとのアダプタはこれを書き出す */
export interface FontGlyph {
  name: string;
  /** .notdef は null */
  unicode: number | null;
  advanceWidth: number;
  contours: Contour[];
}

/** グリフ名：BMP は uniXXXX、それ以外は uXXXXX（AGL の規則） */
export function glyphName(unicode: number): string {
  const hex = unicode.toString(16).toUpperCase();
  return unicode <= 0xffff ? `uni${hex.padStart(4, "0")}` : `u${hex.padStart(5, "0")}`;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** 太さ w の線分（四角形） */
function bar(a: Vec, b: Vec, w: number): Ring {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = (-(b[1] - a[1]) / len) * (w / 2);
  const ny = ((b[0] - a[0]) / len) * (w / 2);
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
}

/** .notdef の箱の位置（フォント座標）と線の太さ。プレビューの SVG でも使う */
export const NOTDEF_BOX = { x0: 100, y0: -40, x1: 900, y1: 760, stroke: 40 } as const;

/** .notdef：枠の中に×を入れた図形。重なりのない輪郭にして、向きをそろえる */
export function notdefContours(): Contour[] {
  const { x0, y0, x1, y1, stroke: w } = NOTDEF_BOX;
  const frame = [rect(x0, y0, x1, y1), rect(x0 + w, y0 + w, x1 - w, y1 - w).reverse()];
  const inner: [Vec, Vec, Vec, Vec] = [
    [x0 + w, y0 + w],
    [x1 - w, y0 + w],
    [x1 - w, y1 - w],
    [x0 + w, y1 - w],
  ];
  const cross = polygonClipping.intersection(
    [rect(x0 + w, y0 + w, x1 - w, y1 - w)],
    polygonClipping.union([bar(inner[0], inner[2], w)], [bar(inner[1], inner[3], w)]),
  );
  const merged = polygonClipping.union(frame, ...cross);
  const contours: Contour[] = [];
  for (const [outer, ...holes] of merged) {
    contours.push(toContour(orientRing(normalizeRing(outer as Vec[]), true)));
    for (const h of holes) contours.push(toContour(orientRing(normalizeRing(h as Vec[]), false)));
  }
  return contours;
}

const toContour = (ring: Ring): Contour =>
  ring.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), onCurve: true }));

/**
 * フォントに入れるグリフの一覧を作る：.notdef（ID 0）、半角スペース、全角スペース、手書きのグリフ（コードポイント順）。
 * 輪郭のないグリフは入れない
 */
export function buildFontGlyphs(outlines: readonly GlyphOutline[]): FontGlyph[] {
  const drawn = outlines
    .filter((o) => o.contours.length > 0 && o.unicode !== 0x20 && o.unicode !== 0x3000)
    .slice()
    .sort((a, b) => a.unicode - b.unicode);
  return [
    { name: ".notdef", unicode: null, advanceWidth: NOTDEF_ADVANCE, contours: notdefContours() },
    { name: "space", unicode: 0x20, advanceWidth: SPACE_ADVANCE, contours: [] },
    { name: "uni3000", unicode: 0x3000, advanceWidth: IDEOGRAPHIC_SPACE_ADVANCE, contours: [] },
    ...drawn.map((o) => ({
      name: glyphName(o.unicode),
      unicode: o.unicode,
      advanceWidth: o.advanceWidth,
      contours: o.contours,
    })),
  ];
}
