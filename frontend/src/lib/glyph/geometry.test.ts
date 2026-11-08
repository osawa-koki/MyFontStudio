import { describe, expect, it } from "vitest";
import { normalizeRing, signedArea, simplifyPolyline, simplifyRing } from "./geometry";
import type { Vec } from "./types";

const square: Vec[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe("signedArea", () => {
  it("y 上向きで反時計回りが正", () => {
    expect(signedArea(square)).toBe(100);
    expect(signedArea(square.slice().reverse())).toBe(-100);
  });
});

describe("normalizeRing", () => {
  it("連続する同じ点と、閉じるための末尾の点を取り除く", () => {
    expect(
      normalizeRing([
        [0, 0],
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});

describe("simplifyPolyline", () => {
  it("許容誤差以下の点を消し、両端は残す", () => {
    const line: Vec[] = [
      [0, 0],
      [5, 0.5],
      [10, 0],
      [15, 5],
      [20, 0],
    ];
    expect(simplifyPolyline(line, 0.8)).toEqual([
      [0, 0],
      [10, 0],
      [15, 5],
      [20, 0],
    ]);
    expect(simplifyPolyline(line.slice(0, 2), 1)).toEqual(line.slice(0, 2));
  });
  it("始点と終点が同じでも動く", () => {
    expect(
      simplifyPolyline(
        [
          [0, 0],
          [5, 5],
          [0, 0],
        ],
        1,
      ),
    ).toHaveLength(3);
  });
});

describe("simplifyRing", () => {
  it("円の点を減らしても形を保つ", () => {
    const circle: Vec[] = Array.from({ length: 360 }, (_, i) => [
      100 * Math.cos((i * Math.PI) / 180),
      100 * Math.sin((i * Math.PI) / 180),
    ]);
    const s = simplifyRing(circle, 0.8);
    expect(s.length).toBeLessThan(60);
    expect(s.length).toBeGreaterThan(10);
    expect(Math.abs(signedArea(s) - signedArea(circle))).toBeLessThan(signedArea(circle) * 0.02);
  });
  it("4 点以下はそのまま", () => {
    expect(simplifyRing(square, 100)).toEqual(square);
  });
});
