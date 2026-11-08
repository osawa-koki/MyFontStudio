import { describe, expect, it } from "vitest";
import type { StrokePoint } from "../../types/project";
import { appendPoint, clientToEm, resolvePressure, roundPoint } from "./record";

describe("roundPoint", () => {
  it("x, y は小数 1 桁、pressure は 2 桁。pressure は 0〜1 に収める", () => {
    expect(roundPoint(120.54, 400.06, 0.523)).toEqual([120.5, 400.1, 0.52]);
    expect(roundPoint(-5.55, 1200, 1.5)).toEqual([-5.5, 1200, 1]);
    expect(roundPoint(0, 0, -1)).toEqual([0, 0, 0]);
  });
});

describe("appendPoint", () => {
  it("前の点から 2 単位未満の移動は間引く", () => {
    const pts: StrokePoint[] = [];
    expect(appendPoint(pts, 100, 100, 0.5)).toBe(true);
    expect(appendPoint(pts, 101, 101, 0.5)).toBe(false);
    expect(appendPoint(pts, 102, 100, 0.5)).toBe(true);
    expect(pts).toEqual([
      [100, 100, 0.5],
      [102, 100, 0.5],
    ]);
  });
});

describe("clientToEm", () => {
  it("表示サイズによらず 0〜1000 にする", () => {
    const rect = { left: 10, top: 20, width: 500, height: 500 };
    expect(clientToEm(10, 20, rect)).toEqual([0, 0]);
    expect(clientToEm(260, 270, rect)).toEqual([500, 500]);
    expect(clientToEm(510, 520, rect)).toEqual([1000, 1000]);
    // 枠の外もそのまま
    expect(clientToEm(0, 20, rect)[0]).toBe(-20);
  });
});

describe("resolvePressure", () => {
  it("筆圧 OFF は 0.5 固定で推定しない", () => {
    expect(resolvePressure("pen", 0.9, false)).toEqual({ pressure: 0.5, simulate: false });
  });
  it("ペンは筆圧を使う（0 なら 0.5）", () => {
    expect(resolvePressure("pen", 0.8, true)).toEqual({ pressure: 0.8, simulate: false });
    expect(resolvePressure("pen", 0, true)).toEqual({ pressure: 0.5, simulate: false });
  });
  it("マウス・指は速度から推定する", () => {
    expect(resolvePressure("mouse", 0.5, true)).toEqual({ pressure: 0.5, simulate: true });
    expect(resolvePressure("touch", 0.3, true)).toEqual({ pressure: 0.5, simulate: true });
  });
});
