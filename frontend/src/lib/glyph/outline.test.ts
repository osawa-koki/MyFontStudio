import polygonClipping from "polygon-clipping";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JUU, KUCHI, LATIN_A, MARU, dot, line, makeGlyph } from "../testing/fixtures";
import { signedArea } from "./geometry";
import {
  countPoints,
  dedupeContour,
  getGlyphOutline,
  glyphToOutline,
  orientRing,
  ringToQuadratic,
  strokeToRing,
  toFontCoords,
  unionRings,
} from "./outline";
import type { Contour, Vec } from "./types";
import { contoursBounds } from "./width";

/** onCurve・offCurve の点を多角形として見たときの符号付き面積（向きの確認用） */
const contourArea = (c: Contour) => signedArea(c.map((p) => [p.x, p.y] as Vec));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("glyphToOutline", () => {
  it("「口」は外側（時計回り）と穴（反時計回り）の 2 つの輪郭になる", () => {
    const o = glyphToOutline(KUCHI);
    expect(o.contours).toHaveLength(2);
    const areas = o.contours.map(contourArea).sort((a, b) => Math.abs(b) - Math.abs(a));
    expect(areas[0]).toBeLessThan(0); // 外側は時計回り
    expect(areas[1]).toBeGreaterThan(0); // 穴は反時計回り
    expect(o.advanceWidth).toBe(1000);
    expect(o.unicode).toBe(0x53e3);
  });

  it("交差する「十」は 1 つの輪郭に合成される", () => {
    const o = glyphToOutline(JUU);
    expect(o.contours).toHaveLength(1);
    expect(contourArea(o.contours[0]!)).toBeLessThan(0);
  });

  it("タップだけの点も円の輪郭になる", () => {
    const o = glyphToOutline(MARU);
    expect(o.contours).toHaveLength(1);
    // 太さ 40 の点 → 半径 20 前後の円。面積はおよそ π×20²
    expect(Math.abs(contourArea(o.contours[0]!))).toBeGreaterThan(800);
    expect(Math.abs(contourArea(o.contours[0]!))).toBeLessThan(2000);
  });

  it("Canvas 座標からフォント座標（y 上向き、ベースライン 0）に変換する", () => {
    // Canvas の (500, 880) はベースライン上
    const o = glyphToOutline(makeGlyph("・", [dot(500, 880)]));
    const b = contoursBounds(o.contours)!;
    expect((b.xMin + b.xMax) / 2).toBeCloseTo(500, -1);
    expect((b.yMin + b.yMax) / 2).toBeCloseTo(0, -1);
  });

  it("座標は整数で、先頭は onCurve", () => {
    for (const g of [KUCHI, JUU, MARU, LATIN_A]) {
      for (const c of glyphToOutline(g).contours) {
        expect(c[0]!.onCurve).toBe(true);
        for (const p of c) {
          expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        }
      }
    }
  });

  it("同じ入力からは常に同じ結果になる", () => {
    expect(JSON.stringify(glyphToOutline(KUCHI))).toBe(JSON.stringify(glyphToOutline(KUCHI)));
  });

  it("半角の英字は左に寄せてプロポーショナルにする", () => {
    const o = glyphToOutline(LATIN_A);
    const b = contoursBounds(o.contours)!;
    expect(b.xMin).toBe(60);
    expect(o.advanceWidth).toBe(b.xMax - b.xMin + 120);
  });

  it("ストロークがなければ輪郭もない", () => {
    expect(glyphToOutline(makeGlyph("空", [])).contours).toEqual([]);
    expect(glyphToOutline(makeGlyph("空", [{ points: [] }])).contours).toEqual([]);
  });

  it("制御点が 3,000 を超えるときは許容誤差を上げて減らす", () => {
    // 細かく揺れる線をたくさん重ねる
    const strokes = Array.from({ length: 40 }, (_, k) => ({
      points: Array.from({ length: 200 }, (_, i) => [
        50 + i * 4.5,
        50 + k * 23 + 8 * Math.sin(i * 1.7 + k),
        0.3 + 0.4 * Math.abs(Math.sin(i * 0.9)),
      ]) as [number, number, number][],
    }));
    const glyph = { ...makeGlyph("緑", strokes), pen: { ...makeGlyph("緑", []).pen, size: 15 } };
    expect(countPoints(glyphToOutline(glyph).contours)).toBeLessThanOrEqual(3000);
  });

  it("合成に失敗したら、各ストロークの輪郭をそのまま使う", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(polygonClipping, "union").mockImplementation(() => {
      throw new Error("boom");
    });
    const o = glyphToOutline(JUU);
    expect(o.contours).toHaveLength(2);
    // どれも外側として時計回り（nonzero で塗れる）
    for (const c of o.contours) expect(contourArea(c)).toBeLessThan(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe("getGlyphOutline", () => {
  it("同じグリフのオブジェクトなら計算し直さない", () => {
    expect(getGlyphOutline(KUCHI)).toBe(getGlyphOutline(KUCHI));
    expect(getGlyphOutline({ ...KUCHI })).not.toBe(getGlyphOutline(KUCHI));
  });
});

describe("strokeToRing / unionRings", () => {
  it("ストロークごとの simulatePressure がグリフの値より優先される", () => {
    const pts = line(100, 500, 900, 500, 30).points.map(
      (p, i) => [p[0], p[1], i % 2 ? 0.1 : 0.9] as [number, number, number],
    );
    const pen = { ...KUCHI.pen, simulatePressure: false };
    const a = strokeToRing({ points: pts }, pen);
    const b = strokeToRing({ points: pts, simulatePressure: true }, pen);
    expect(a).not.toEqual(b);
  });
  it("空の輪郭は合成しない", () => {
    expect(unionRings([[]])).toEqual([]);
  });
});

describe("toFontCoords / orientRing", () => {
  it("y を反転し、ベースラインを 0 にする", () => {
    expect(toFontCoords([[100, 880]])).toEqual([[100, 0]]);
    expect(toFontCoords([[0, 0]])).toEqual([[0, 880]]);
  });
  it("指定した向きにそろえる", () => {
    const ccw: Vec[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(signedArea(orientRing(ccw, true))).toBeLessThan(0);
    expect(orientRing(ccw, false)).toEqual(ccw);
  });
});

describe("ringToQuadratic / dedupeContour", () => {
  it("中点を onCurve、元の点を offCurve にする", () => {
    expect(
      ringToQuadratic([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toEqual([
      { x: 5, y: 0, onCurve: true },
      { x: 10, y: 0, onCurve: false },
      { x: 10, y: 5, onCurve: true },
      { x: 10, y: 10, onCurve: false },
      { x: 5, y: 10, onCurve: true },
      { x: 0, y: 10, onCurve: false },
      { x: 0, y: 5, onCurve: true },
      { x: 0, y: 0, onCurve: false },
    ]);
  });
  it("丸めて重なった点を取り除き、先頭を onCurve にする", () => {
    expect(
      dedupeContour([
        { x: 0, y: 0, onCurve: false },
        { x: 0, y: 0, onCurve: true },
        { x: 0, y: 0, onCurve: true },
        { x: 10, y: 0, onCurve: true },
        { x: 10, y: 10, onCurve: false },
        { x: 0, y: 10, onCurve: true },
      ]),
    ).toEqual([
      { x: 0, y: 0, onCurve: true },
      { x: 10, y: 0, onCurve: true },
      { x: 10, y: 10, onCurve: false },
      { x: 0, y: 10, onCurve: true },
    ]);
  });
  it("末尾と先頭が同じ onCurve なら 1 つにする", () => {
    expect(
      dedupeContour([
        { x: 0, y: 0, onCurve: true },
        { x: 10, y: 0, onCurve: true },
        { x: 10, y: 10, onCurve: true },
        { x: 0, y: 0, onCurve: true },
      ]),
    ).toHaveLength(3);
  });
});
