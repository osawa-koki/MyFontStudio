import { describe, expect, it } from "vitest";
import { contoursToSvgPath } from "./path";

describe("contoursToSvgPath", () => {
  it("onCurve だけなら直線", () => {
    expect(
      contoursToSvgPath([
        [
          { x: 0, y: 0, onCurve: true },
          { x: 10, y: 0, onCurve: true },
          { x: 10, y: 10, onCurve: true },
        ],
      ]),
    ).toBe("M0 0L10 0L10 10L0 0Z");
  });
  it("offCurve を挟めば二次ベジェ。最後の offCurve は始点に戻る", () => {
    expect(
      contoursToSvgPath([
        [
          { x: 0, y: 0, onCurve: true },
          { x: 5, y: 5, onCurve: false },
          { x: 10, y: 0, onCurve: true },
          { x: 5, y: -5, onCurve: false },
        ],
      ]),
    ).toBe("M0 0Q5 5 10 0Q5 -5 0 0Z");
  });
  it("offCurve が続けば中点を補い、先頭が offCurve でも onCurve から始める", () => {
    expect(
      contoursToSvgPath([
        [
          { x: 0, y: 10, onCurve: false },
          { x: 0, y: 0, onCurve: true },
          { x: 10, y: 0, onCurve: false },
          { x: 10, y: 10, onCurve: false },
        ],
      ]),
    ).toBe("M0 0Q10 0 10 5Q10 10 5 10Q0 10 0 0Z");
  });
  it("すべて offCurve でも閉じた曲線になる", () => {
    const path = contoursToSvgPath([
      [
        { x: 0, y: 0, onCurve: false },
        { x: 10, y: 0, onCurve: false },
        { x: 10, y: 10, onCurve: false },
        { x: 0, y: 10, onCurve: false },
      ],
    ]);
    expect(path.startsWith("M5 0")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path.match(/Q/g)).toHaveLength(4);
  });
  it("空の輪郭は飛ばす", () => {
    expect(contoursToSvgPath([[]])).toBe("");
  });
});
