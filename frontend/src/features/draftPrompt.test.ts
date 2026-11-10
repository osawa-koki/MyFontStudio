import { beforeEach, describe, expect, it } from "vitest";
import { addStroke, clearStrokes } from "../lib/stroke/history";
import { KUCHI } from "../lib/testing/fixtures";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { useUiStore } from "../store/uiStore";
import { confirmCommitDrafts, splitDrafts } from "./draftPrompt";

const store = () => useProjectStore.getState();
const stroke = { points: [[500, 500, 0.5]] as [number, number, number][] };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("confirmCommitDrafts", () => {
  beforeEach(() => {
    store().newProject("Draft");
    useEditorStore.getState().reset();
    store().saveGlyph(KUCHI);
    // 「口」は作成済みの線をすべて消した、「十」は描きかけ
    store().updateDrawing("口", (h) => clearStrokes(h));
    store().addChars(["十"]);
    store().updateDrawing("十", (h) => addStroke(h, stroke));
  });

  it("描きかけの文字と、線を消した作成済みの文字（未作成に戻る文字）を分ける", () => {
    expect(splitDrafts(["口", "十"])).toEqual({ drafts: ["十"], reverts: ["口"] });
  });

  it("未作成に戻る文字は、フォントから消えることを分けて示す。「保存する」で描きかけは保存し、線を消した文字は未作成に戻す", async () => {
    const done = confirmCommitDrafts("保存しない文字は、フォントに入りません");
    await flush();
    const message = useUiStore.getState().dialog!.message!;
    expect(message).toContain("描きかけの線があります：十");
    expect(message).toMatch(
      /線をすべて消した作成済みの文字があります：口.*未作成に戻します。フォントからも消えます/,
    );
    useUiStore.getState().closeDialog("save");
    expect(await done).toBe(true);
    expect(store().project.glyphs["口"]).toBeUndefined();
    expect(store().project.glyphs["十"]?.strokes).toHaveLength(1);
  });

  it("キャンセルなら何もしない（false）", async () => {
    const done = confirmCommitDrafts("x");
    await flush();
    useUiStore.getState().closeDialog("cancel");
    expect(await done).toBe(false);
    expect(store().project.glyphs["口"]).toBe(KUCHI);
  });
});
