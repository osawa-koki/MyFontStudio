import { beforeEach, describe, expect, it } from "vitest";
import { KUCHI } from "../lib/testing/fixtures";
import { historyFor, penFor, useEditorStore } from "./editorStore";
import { useProjectStore } from "./projectStore";

const e = () => useEditorStore.getState();
const stroke = { points: [[1, 1, 0.5]] as [number, number, number][] };

describe("editorStore", () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    e().reset();
  });

  it("描きかけがなければ保存済みのストロークから始める", () => {
    useProjectStore.getState().saveGlyph(KUCHI);
    expect(historyFor(e(), "口").strokes).toBe(KUCHI.strokes);
    expect(historyFor(e(), "x").strokes).toEqual([]);
  });

  it("文字ごとに履歴を持つ", () => {
    e().commitStroke("a", stroke);
    e().commitStroke("b", stroke);
    e().commitStroke("b", stroke);
    e().undo("b");
    expect(historyFor(e(), "a").strokes).toHaveLength(1);
    expect(historyFor(e(), "b").strokes).toHaveLength(1);
    e().redo("b");
    expect(historyFor(e(), "b").strokes).toHaveLength(2);
    e().clear("b");
    expect(historyFor(e(), "b").strokes).toHaveLength(0);
    e().discard("b");
    expect(e().histories.b).toBeUndefined();
  });

  it("ペンは保存したときの値→初期値の順。変えると初期値にもする", () => {
    useProjectStore.getState().saveGlyph({ ...KUCHI, pen: { ...KUCHI.pen, size: 70 } });
    expect(penFor(e(), "口").size).toBe(70);
    expect(penFor(e(), "x").size).toBe(40);
    e().setPen("x", { size: 55 });
    expect(penFor(e(), "x").size).toBe(55);
    expect(useProjectStore.getState().project.defaults.pen.size).toBe(55);
    expect(penFor(e(), "口").size).toBe(70);
  });

  it("ignoreTouch", () => {
    e().setIgnoreTouch(true);
    expect(e().ignoreTouch).toBe(true);
  });
});
