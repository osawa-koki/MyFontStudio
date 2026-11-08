import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../project/project";
import { JUU, KUCHI, MARU, makeGlyph } from "../testing/fixtures";
import { collectOutlines, collectOutlinesAsync } from "./outlines";

const project = () => {
  const p = createEmptyProject();
  p.queue = ["十", "未", "口"];
  p.glyphs = { 口: KUCHI, 十: JUU, "。": MARU, 空: makeGlyph("空", []) };
  return p;
};

describe("collectOutlinesAsync", () => {
  it("collectOutlines と同じ結果。区切りごとに処理を譲る", async () => {
    let yields = 0;
    const r = await collectOutlinesAsync(project(), {
      sliceMs: -1,
      yieldFn: async () => void yields++,
    });
    expect(r!.map((o) => o.char)).toEqual(collectOutlines(project()).map((o) => o.char));
    expect(yields).toBeGreaterThan(0);
  });
  it("取り消されたら null", async () => {
    expect(
      await collectOutlinesAsync(project(), { sliceMs: -1, cancelled: () => true }),
    ).toBeNull();
  });
  it("既定の譲り方でも動く", async () => {
    expect((await collectOutlinesAsync(project()))!.length).toBe(3);
  });
});
