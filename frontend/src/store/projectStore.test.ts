import { beforeEach, describe, expect, it } from "vitest";
import type { GlyphData } from "../types/project";
import { useProjectStore } from "./projectStore";

const glyph = (char: string): GlyphData => ({
  char,
  codepoint: "U+" + char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
  canvasSize: 1000,
  widthMode: "auto",
  pen: { size: 40, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false },
  strokes: [{ points: [[1, 2, 0.5]] }],
  updatedAt: "2026-11-08T00:00:00+09:00",
});

const s = () => useProjectStore.getState();

describe("projectStore", () => {
  beforeEach(() => {
    s().newProject();
    s().markSaved();
  });

  it("newProject は空のプロジェクトを作り、作業中にする", () => {
    s().newProject("Foo");
    expect(s().project.font.familyName).toBe("Foo");
    expect(s().started).toBe(true);
    expect(s().dirty).toBe(false);
  });

  it("addChars は重複を除いて末尾に追加し、未保存にする", () => {
    expect(s().addChars(["大", "澤", "大"])).toEqual(["大", "澤"]);
    expect(s().addChars(["澤", "太"])).toEqual(["太"]);
    expect(s().project.queue).toEqual(["大", "澤", "太"]);
    expect(s().dirty).toBe(true);
  });

  it("addChars で何も増えなければ未保存にしない", () => {
    expect(s().addChars([])).toEqual([]);
    expect(s().dirty).toBe(false);
  });

  it("saveGlyph は登録し、一覧になければ追加する", () => {
    s().addChars(["大"]);
    s().saveGlyph(glyph("大"));
    s().saveGlyph(glyph("郎"));
    expect(Object.keys(s().project.glyphs)).toEqual(["大", "郎"]);
    expect(s().project.queue).toEqual(["大", "郎"]);
  });

  it("removeChar は一覧とグリフから消し、編集中ならはずす", () => {
    s().addChars(["大", "澤"]);
    s().saveGlyph(glyph("大"));
    s().setCurrentChar("大");
    s().removeChar("大");
    expect(s().project.queue).toEqual(["澤"]);
    expect(s().project.glyphs["大"]).toBeUndefined();
    expect(s().currentChar).toBeNull();
    s().setCurrentChar("澤");
    s().removeChar("x");
    expect(s().currentChar).toBe("澤");
  });

  it("setFontSettings は値を直して設定する。英数字のないフォント名は無視する", () => {
    s().setFontSettings({ familyName: "My Font", familyNameJa: " 大澤手書き ", designer: "大澤" });
    expect(s().project.font).toMatchObject({
      familyName: "MyFont",
      familyNameJa: "大澤手書き",
      designer: "大澤",
    });
    s().setFontSettings({ familyName: "日本語" });
    expect(s().project.font.familyName).toBe("MyFont");
    s().setFontSettings({ exportCount: 5 });
    expect(s().project.font.exportCount).toBe(5);
  });

  it("setDefaults・setPreviewText", () => {
    s().setDefaults({ usePressure: false });
    expect(s().project.defaults.usePressure).toBe(false);
    expect(s().project.defaults.showModel).toBe(true);
    s().markSaved();
    s().setPreviewText("大", { dirty: false });
    expect(s().dirty).toBe(false);
    s().setPreviewText("大澤太郎");
    expect(s().project.previewText).toBe("大澤太郎");
    expect(s().dirty).toBe(true);
  });

  it("incrementExportCount は 1 ずつ増やす", () => {
    expect(s().incrementExportCount()).toBe(1);
    expect(s().incrementExportCount()).toBe(2);
    expect(s().project.font.exportCount).toBe(2);
  });

  it("loadProject は置き換えて保存済みにする", () => {
    s().addChars(["a"]);
    const p = { ...s().project, queue: ["x"] };
    s().loadProject(p);
    expect(s().project.queue).toEqual(["x"]);
    expect(s().dirty).toBe(false);
    s().loadProject(p, { dirty: true });
    expect(s().dirty).toBe(true);
  });
});
