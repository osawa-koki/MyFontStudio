import { describe, expect, it } from "vitest";
import { guideLines } from "./guides";

describe("guideLines", () => {
  it("外枠・中心線・推奨範囲・ベースライン（y=880）", () => {
    const g = guideLines(false);
    expect(g.filter((l) => l.kind === "frame")).toHaveLength(4);
    expect(g.filter((l) => l.kind === "safe").every((l) => l.dashed)).toBe(true);
    expect(g.find((l) => l.kind === "baseline")).toMatchObject({ y1: 880, y2: 880 });
    expect(g.some((l) => l.kind === "xHeight")).toBe(false);
  });
  it("半角は x-height（y=380）とキャップハイト（y=180）も出す", () => {
    const g = guideLines(true);
    expect(g.find((l) => l.kind === "xHeight")).toMatchObject({ y1: 380 });
    expect(g.find((l) => l.kind === "capHeight")).toMatchObject({ y1: 180 });
  });
});
