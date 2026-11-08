import * as opentypeNs from "opentype.js";
import type { Contour } from "../glyph/types";
import type { FontGlyph } from "./glyphs";
import { HHEA_ASCENDER, HHEA_DESCENDER, UNITS_PER_EM } from "./metrics";
import { finalizeFont } from "./sfnt";
import type { FontSpec } from "./spec";

// Vite（ESM の dist/opentype.mjs）では名前付きのエクスポート、Node（UMD の dist/opentype.js）では default に入る
const opentype: typeof opentypeNs =
  "Font" in opentypeNs
    ? opentypeNs
    : (opentypeNs as unknown as { default: typeof opentypeNs }).default;

/**
 * TrueType の向き（外側が時計回り）の輪郭を、CFF の向き（外側が反時計回り）の Path にする。
 * 点の順番を逆にし、二次ベジェは quadraticCurveTo で渡す（opentype.js が三次に変換する）
 */
export function contoursToPath(contours: readonly Contour[]): opentypeNs.Path {
  const path = new opentype.Path();
  for (const contour of contours) {
    if (contour.length === 0) continue;
    // 先頭（onCurve）はそのままに、残りを逆順にする
    const pts = [contour[0]!, ...contour.slice(1).reverse()];
    path.moveTo(pts[0]!.x, pts[0]!.y);
    let pending: { x: number; y: number } | null = null;
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length]!;
      if (p.onCurve) {
        if (pending) path.quadraticCurveTo(pending.x, pending.y, p.x, p.y);
        else if (i < pts.length) path.lineTo(p.x, p.y);
        pending = null;
      } else if (pending) {
        const mid = { x: (pending.x + p.x) / 2, y: (pending.y + p.y) / 2 };
        path.quadraticCurveTo(pending.x, pending.y, mid.x, mid.y);
        pending = p;
      } else {
        pending = p;
      }
    }
    path.close();
  }
  return path;
}

/** opentype.js で CFF アウトラインの .otf を書き出す */
export function buildOtf(spec: FontSpec, glyphs: readonly FontGlyph[]): ArrayBuffer {
  const font = new opentype.Font({
    familyName: spec.familyName,
    styleName: spec.styleName,
    unitsPerEm: UNITS_PER_EM,
    ascender: HHEA_ASCENDER,
    descender: HHEA_DESCENDER,
    glyphs: glyphs.map(
      (g) =>
        new opentype.Glyph({
          name: g.name,
          // cmap の format 12（BMP 外の文字）を出すかは unicode で判定されるので、unicodes と両方渡す
          ...(g.unicode === null
            ? { unicodes: [] }
            : { unicode: g.unicode, unicodes: [g.unicode] }),
          advanceWidth: g.advanceWidth,
          path: contoursToPath(g.contours),
        }),
    ),
  });
  return finalizeFont(font.toArrayBuffer(), spec, glyphs);
}
