import { describe, expect, it } from "vitest";
import type { Stroke } from "../../types/project";
import {
  HISTORY_LIMIT,
  addStroke,
  canRedo,
  canUndo,
  clearStrokes,
  createHistory,
  isDirty,
  redo,
  undo,
} from "./history";

const s = (x: number): Stroke => ({ points: [[x, x, 0.5]] });

describe("history", () => {
  it("追加・元に戻す・やり直し", () => {
    let h = createHistory();
    expect(canUndo(h)).toBe(false);
    h = addStroke(h, s(1));
    h = addStroke(h, s(2));
    expect(h.strokes).toEqual([s(1), s(2)]);
    h = undo(h);
    expect(h.strokes).toEqual([s(1)]);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.strokes).toEqual([s(1), s(2)]);
    expect(canRedo(h)).toBe(false);
  });

  it("新しく描くとやり直しの履歴は消える", () => {
    let h = addStroke(addStroke(createHistory(), s(1)), s(2));
    h = addStroke(undo(h), s(3));
    expect(h.strokes).toEqual([s(1), s(3)]);
    expect(canRedo(h)).toBe(false);
  });

  it("クリアは元に戻せる。空ならなにもしない", () => {
    let h = addStroke(createHistory([s(9)]), s(1));
    h = clearStrokes(h);
    expect(h.strokes).toEqual([]);
    expect(undo(h).strokes).toEqual([s(9), s(1)]);
    expect(clearStrokes(h)).toBe(h);
  });

  it("履歴がなければ元に戻す・やり直しはそのまま", () => {
    const h = createHistory();
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("履歴は上限まで", () => {
    let h = createHistory();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = addStroke(h, s(i));
    expect(h.undoStack).toHaveLength(HISTORY_LIMIT);
  });

  it("isDirty は保存済みのストロークとの違い", () => {
    const saved = [s(1)];
    expect(isDirty(createHistory(saved), saved)).toBe(false);
    expect(isDirty(createHistory([s(1)]), saved)).toBe(false);
    expect(isDirty(createHistory([s(2)]), saved)).toBe(true);
    expect(isDirty(addStroke(createHistory(saved), s(2)), saved)).toBe(true);
    expect(isDirty(createHistory(), undefined)).toBe(false);
  });
});
