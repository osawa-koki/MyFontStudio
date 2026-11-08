import { Font } from "fonteditor-core";
import type { FontGlyph } from "./glyphs";
import { HHEA_ASCENDER, HHEA_DESCENDER, HHEA_LINE_GAP, UNITS_PER_EM } from "./metrics";
import { finalizeFont } from "./sfnt";
import type { FontSpec } from "./spec";
import { contoursBounds } from "../glyph/width";

/** fonteditor-core で TrueType（glyf）の .ttf を書き出す。輪郭（二次ベジェ）はそのまま入れる */
export function buildTtf(spec: FontSpec, glyphs: readonly FontGlyph[]): ArrayBuffer {
  const font = Font.create();
  const ttf = font.get();
  ttf.head.unitsPerEm = UNITS_PER_EM;
  ttf.head.lowestRecPPEM = 8;
  ttf.hhea.ascent = HHEA_ASCENDER;
  ttf.hhea.descent = HHEA_DESCENDER;
  ttf.hhea.lineGap = HHEA_LINE_GAP;
  // name・OS/2 は finalizeFont で差し替える。ここではライブラリが必要とする最小限を入れる
  ttf.name = {
    ...ttf.name,
    fontFamily: spec.familyName,
    fontSubFamily: spec.styleName,
    fullName: `${spec.familyName} ${spec.styleName}`,
    postScriptName: spec.postScriptName,
    version: spec.versionString,
    uniqueSubFamily: spec.uniqueId,
  };
  ttf.glyf = glyphs.map((g) => {
    // 空のグリフ（スペース）には bbox を付けない（付けると head・hhea の最小値に 0 が入る）
    const b = contoursBounds(g.contours);
    return {
      name: g.name,
      unicode: g.unicode === null ? [] : [g.unicode],
      advanceWidth: g.advanceWidth,
      leftSideBearing: b?.xMin ?? 0,
      ...b,
      contours: g.contours.map((c) => c.map((p) => ({ x: p.x, y: p.y, onCurve: p.onCurve }))),
    } as (typeof ttf.glyf)[number];
  });
  font.set(ttf);
  const out = font.write({
    type: "ttf",
    toBuffer: false,
    support: { hhea: hheaExtents(glyphs) },
  }) as ArrayBuffer;
  return finalizeFont(out, spec, glyphs);
}

/** hhea の最小の左右のサイドベアリングなど。fonteditor-core は空のグリフ（スペース）も数えるので、輪郭のあるグリフだけで計算する */
export function hheaExtents(glyphs: readonly FontGlyph[]) {
  let minLeftSideBearing = Infinity;
  let minRightSideBearing = Infinity;
  let xMaxExtent = -Infinity;
  for (const g of glyphs) {
    const b = contoursBounds(g.contours);
    if (!b) continue;
    minLeftSideBearing = Math.min(minLeftSideBearing, b.xMin);
    minRightSideBearing = Math.min(minRightSideBearing, g.advanceWidth - b.xMax);
    xMaxExtent = Math.max(xMaxExtent, b.xMax);
  }
  if (xMaxExtent === -Infinity) return {};
  return { minLeftSideBearing, minRightSideBearing, xMaxExtent };
}
