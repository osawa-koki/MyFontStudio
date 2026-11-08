import { beforeEach, describe, expect, it } from "vitest";
import { strokesOf } from "../lib/stroke/history";
import { KUCHI } from "../lib/testing/fixtures";
import { historyFor, penFor, useEditorStore } from "./editorStore";
import { useProjectStore } from "./projectStore";

const e = () => useEditorStore.getState();
const p = () => useProjectStore.getState();
const stroke = { points: [[1, 1, 0.5]] as [number, number, number][] };
const strokes = (c: string) => strokesOf(historyFor(c));

describe("editorStore", () => {
  beforeEach(() => {
    p().newProject();
    e().reset();
  });

  it("描いた履歴がなければ保存済みの線から始める", () => {
    p().saveGlyph(KUCHI);
    expect(strokes("口")).toEqual(KUCHI.strokes);
    expect(strokes("x")).toEqual([]);
  });

  it("文字ごとの履歴をプロジェクトに入れる", () => {
    e().commitStroke("a", stroke);
    e().commitStroke("b", stroke);
    e().commitStroke("b", stroke);
    e().undo("b");
    expect(strokes("a")).toHaveLength(1);
    expect(strokes("b")).toHaveLength(1);
    expect(p().project.drawings.b!.ops).toHaveLength(2);
    e().redo("b");
    expect(strokes("b")).toHaveLength(2);
    e().clear("b");
    expect(strokes("b")).toHaveLength(0);
    e().discard("b");
    expect(p().project.drawings.b).toBeUndefined();
  });

  it("変わらない操作（何もない状態の元に戻すなど）では履歴を作らない", () => {
    p().saveGlyph(KUCHI);
    const before = p().project;
    e().redo("口");
    expect(p().project.drawings["口"]).toBeDefined();
    const after = p().project;
    e().redo("口");
    expect(p().project).toBe(after);
    expect(before).not.toBe(after);
  });

  it("文字を一覧から消すと履歴も消える", () => {
    p().addChars(["a"]);
    e().commitStroke("a", stroke);
    p().removeChar("a");
    expect(p().project.drawings.a).toBeUndefined();
  });

  it("ペンは保存したときの値→初期値の順。変えると初期値にもする", () => {
    p().saveGlyph({ ...KUCHI, pen: { ...KUCHI.pen, size: 70 } });
    expect(penFor(e(), "口").size).toBe(70);
    expect(penFor(e(), "x").size).toBe(40);
    e().setPen("x", { size: 55 });
    expect(penFor(e(), "x").size).toBe(55);
    expect(p().project.defaults.pen.size).toBe(55);
    expect(penFor(e(), "口").size).toBe(70);
  });

  it("ペンを検出したら指の入力を無視する。利用者が切り替えたあとは変えない", () => {
    useEditorStore.setState({ ignoreTouch: false, ignoreTouchChosen: false });
    expect(e().penDetected()).toBe(true);
    expect(e().ignoreTouch).toBe(true);
    // すでに ON なら知らせない
    expect(e().penDetected()).toBe(false);
    e().setIgnoreTouch(false);
    expect(e().ignoreTouchChosen).toBe(true);
    expect(e().penDetected()).toBe(false);
    expect(e().ignoreTouch).toBe(false);
  });
});
