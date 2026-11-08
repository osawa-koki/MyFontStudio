import { describe, expect, it } from "vitest";
import { JUU, KUCHI, MARU } from "../testing/fixtures";
import { getGlyphOutline } from "./outline";
import { createOutlineScheduler } from "./scheduler";

describe("createOutlineScheduler", () => {
  it("区切りごとに処理を譲りながら計算し、結果はキャッシュと同じ", async () => {
    let yields = 0;
    let t = 0;
    const s = createOutlineScheduler({
      sliceMs: 1,
      // 1 回の計算で時間を使い切ったことにする
      now: () => (t += 1),
      yieldFn: (run) => {
        yields++;
        setTimeout(run, 0);
      },
    });
    const a = { ...KUCHI };
    const b = { ...JUU };
    const [oa, ob, oa2] = await Promise.all([s.request(a), s.request(b), s.request(a)]);
    expect(oa).toBe(getGlyphOutline(a));
    expect(ob).toBe(getGlyphOutline(b));
    expect(oa2).toBe(oa);
    expect(yields).toBeGreaterThanOrEqual(2);
    expect(s.pending()).toBe(0);
  });
  it("キャッシュにあればすぐに返す", async () => {
    const s = createOutlineScheduler();
    const g = { ...MARU };
    const outline = getGlyphOutline(g);
    await expect(s.request(g)).resolves.toBe(outline);
    expect(s.pending()).toBe(0);
  });
});
