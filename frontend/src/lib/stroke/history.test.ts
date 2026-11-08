import { describe, expect, it } from "vitest";
import type { Stroke } from "../../types/project";
import {
  addStroke,
  canRedo,
  canUndo,
  clearStrokes,
  createHistory,
  isDirty,
  redo,
  strokesOf,
  undo,
} from "./history";

const s = (x: number): Stroke => ({ points: [[x, x, 0.5]] });

describe("history", () => {
  it("追加・元に戻す・やり直し", () => {
    let h = createHistory();
    expect(canUndo(h)).toBe(false);
    h = addStroke(h, s(1));
    h = addStroke(h, s(2));
    expect(strokesOf(h)).toEqual([s(1), s(2)]);
    h = undo(h);
    expect(strokesOf(h)).toEqual([s(1)]);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(strokesOf(h)).toEqual([s(1), s(2)]);
    expect(canRedo(h)).toBe(false);
  });

  it("保存済みの線から作ると、元に戻すで 1 本ずつ消せる", () => {
    let h = createHistory([s(1), s(2)]);
    expect(h.position).toBe(2);
    h = undo(h);
    expect(strokesOf(h)).toEqual([s(1)]);
  });

  it("新しく描くとやり直しの操作は捨てる", () => {
    let h = addStroke(addStroke(createHistory(), s(1)), s(2));
    h = addStroke(undo(h), s(3));
    expect(strokesOf(h)).toEqual([s(1), s(3)]);
    expect(h.ops).toHaveLength(2);
    expect(canRedo(h)).toBe(false);
  });

  it("クリアは元に戻せる。クリアのあとに描いた線だけが残る。空ならなにもしない", () => {
    let h = addStroke(createHistory([s(9)]), s(1));
    h = clearStrokes(h);
    expect(strokesOf(h)).toEqual([]);
    expect(strokesOf(undo(h))).toEqual([s(9), s(1)]);
    expect(clearStrokes(h)).toBe(h);
    h = addStroke(h, s(5));
    expect(strokesOf(h)).toEqual([s(5)]);
  });

  it("履歴がなければ元に戻す・やり直しはそのまま", () => {
    const h = createHistory();
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("strokesOf は同じ履歴ならキャッシュを返す", () => {
    const h = createHistory([s(1)]);
    expect(strokesOf(h)).toBe(strokesOf(h));
  });

  it("isDirty は保存済みの線との違い", () => {
    const saved = [s(1)];
    expect(isDirty(createHistory(saved), saved)).toBe(false);
    expect(isDirty(createHistory([s(1)]), saved)).toBe(false);
    expect(isDirty(createHistory([s(2)]), saved)).toBe(true);
    expect(isDirty(addStroke(createHistory(saved), s(2)), saved)).toBe(true);
    expect(isDirty(createHistory(), undefined)).toBe(false);
  });
});
