import { isoWithOffset } from "../lib/project/chars";
import { toCodepointLabel } from "../lib/project/project";
import { historyFor, penFor, useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import type { GlyphData } from "../types/project";

/** 描きかけのストロークを、その文字のグリフとして保存する（保存時点のペンを記録する）。ストロークがなければ false */
export function commitDraft(char: string): boolean {
  const editor = useEditorStore.getState();
  const history = historyFor(editor, char);
  if (history.strokes.length === 0) return false;
  const store = useProjectStore.getState();
  const glyph: GlyphData = {
    char,
    codepoint: toCodepointLabel(char),
    canvasSize: 1000,
    widthMode: store.project.glyphs[char]?.widthMode ?? "auto",
    pen: {
      ...penFor(editor, char),
      simulatePressure: history.strokes[0]?.simulatePressure ?? false,
    },
    strokes: history.strokes,
    updatedAt: isoWithOffset(),
  };
  store.saveGlyph(glyph);
  editor.discard(char);
  return true;
}
