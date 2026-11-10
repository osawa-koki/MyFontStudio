import { beforeEach, describe, expect, it } from "vitest";
import { addStroke, clearStrokes, createHistory } from "../lib/stroke/history";
import { KUCHI } from "../lib/testing/fixtures";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { commitDraft } from "./glyphActions";
import { unsavedDraftChars } from "./unsavedWarning";

const store = () => useProjectStore.getState();
const stroke = { points: [[500, 500, 0.5]] as [number, number, number][] };

describe("commitDraft", () => {
  beforeEach(() => {
    store().newProject("Commit");
    useEditorStore.getState().reset();
    store().saveGlyph(KUCHI);
    store().markSaved();
  });

  it("線がなければ、未作成の文字では何もしない（false）", () => {
    expect(commitDraft("未")).toBe(false);
  });

  it("作成済みの文字の線をすべて消して保存すると、未作成に戻す（一覧と描いた履歴は残す）", () => {
    store().updateDrawing("口", (h) => clearStrokes(h));
    expect(unsavedDraftChars()).toEqual(["口"]);
    expect(commitDraft("口")).toBe(true);
    expect(store().project.glyphs["口"]).toBeUndefined();
    expect(store().project.queue).toContain("口");
    expect(store().project.drawings["口"]).toBeDefined();
    expect(store().dirty).toBe(true);
    // 未作成に戻したので、描きかけとして確かめ続けない
    expect(unsavedDraftChars()).toEqual([]);
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
