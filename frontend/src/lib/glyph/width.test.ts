import { describe, expect, it } from "vitest";
import type { Contour } from "./types";
import { contoursBounds, isFullWidth, isFullWidthChar, layoutGlyph } from "./width";

const box = (x0: number, x1: number): Contour => [
  { x: x0, y: 0, onCurve: true },
  { x: x0, y: 500, onCurve: true },
  { x: x1, y: 500, onCurve: true },
  { x: x1, y: 0, onCurve: true },
];

describe("isFullWidthChar", () => {
  it.each(["あ", "ア", "漢", "Ａ", "○", "×", "°", "α", "、", "𠮷"])("%s は全角（W・F・A）", (c) => {
    expect(isFullWidthChar(c)).toBe(true);
  });
  it.each(["A", "1", "!", "ｱ", "é", "ñ", "~"])("%s は半角（Na・H・N と、A のラテン文字）", (c) => {
    expect(isFullWidthChar(c)).toBe(false);
  });
  it("空文字は半角", () => {
    expect(isFullWidthChar("")).toBe(false);
  });
});

describe("isFullWidth", () => {
  it("widthMode で上書きできる", () => {
    expect(isFullWidth("A", "full")).toBe(true);
    expect(isFullWidth("あ", "half")).toBe(false);
    expect(isFullWidth("あ", "auto")).toBe(true);
  });
});

describe("layoutGlyph", () => {
  it("全角は 1000 で、位置はそのまま", () => {
    const contours = [box(300, 700)];
    expect(layoutGlyph(contours, "あ", "auto")).toEqual({ contours, advanceWidth: 1000 });
  });
  it("半角は左端を 60 にそろえ、幅＋120 を送り幅にする", () => {
    const r = layoutGlyph([box(300, 700)], "A", "auto");
    expect(r.advanceWidth).toBe(520);
    expect(contoursBounds(r.contours)).toMatchObject({ xMin: 60, xMax: 460 });
  });
  it("左端がすでに 60 なら動かさない", () => {
    const contours = [box(60, 460)];
    expect(layoutGlyph(contours, "A", "auto").contours).toBe(contours);
  });
  it("狭い半角は 250 にして中央に置く", () => {
    const r = layoutGlyph([box(480, 520)], "!", "auto");
    expect(r.advanceWidth).toBe(250);
    expect(contoursBounds(r.contours)).toMatchObject({ xMin: 105, xMax: 145 });
  });
  it("輪郭のない半角は 250", () => {
    expect(layoutGlyph([], "A", "auto").advanceWidth).toBe(250);
  });
});
