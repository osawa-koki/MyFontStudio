import { beforeEach, describe, expect, it } from "vitest";
import { addStroke, createHistory } from "../lib/stroke/history";
import { KUCHI } from "../lib/testing/fixtures";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { commitDraft } from "./glyphActions";

const store = () => useProjectStore.getState();
const stroke = { points: [[500, 500, 0.5]] as [number, number, number][] };

describe("commitDraft", () => {
  beforeEach(() => {
    store().newProject("Commit");
    useEditorStore.getState().reset();
    store().saveGlyph(KUCHI);
    store().markSaved();
  });

  it("線がなければ保存しない（false）", () => {
    expect(commitDraft("未")).toBe(false);
  });

  it("線もペンも保存済みと同じなら、保存し直さない（zip 未保存・更新日時を変えない）", () => {
    // 保存済みの線から作った履歴（作成済みの文字を開いただけ）
    store().updateDrawing("口", () => createHistory(KUCHI.strokes));
    store().markSaved();
    expect(commitDraft("口")).toBe(true);
    expect(store().project.glyphs["口"]).toBe(KUCHI);
    expect(store().dirty).toBe(false);
  });

  it("線を足したら保存する", () => {
    store().updateDrawing("口", (h) => addStroke(h, stroke));
    expect(commitDraft("口")).toBe(true);
    expect(store().project.glyphs["口"]!.strokes).toHaveLength(KUCHI.strokes.length + 1);
    expect(store().dirty).toBe(true);
  });

  it("ペンだけを変えたら、文字全体の見た目が変わるので保存し直す", () => {
    useEditorStore.getState().setPen("口", { size: KUCHI.pen.size + 10 });
    store().markSaved();
    expect(commitDraft("口")).toBe(true);
    expect(store().project.glyphs["口"]!.pen.size).toBe(KUCHI.pen.size + 10);
    expect(store().project.glyphs["口"]!.strokes).toEqual(KUCHI.strokes);
    expect(store().dirty).toBe(true);
  });
});
