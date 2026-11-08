import { isoWithOffset } from "../lib/project/chars";
import { toCodepointLabel } from "../lib/project/project";
import { strokesOf } from "../lib/stroke/history";
import { historyFor, penFor, useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import type { GlyphData } from "../types/project";

/**
 * 描いた線を、その文字のグリフとして保存する（保存時点のペンを記録する）。線がなければ false。
 * 描いた履歴はそのまま残すので、保存したあとも元に戻す・やり直しができる
 */
export function commitDraft(char: string): boolean {
  const strokes = strokesOf(historyFor(char));
  if (strokes.length === 0) return false;
  const store = useProjectStore.getState();
  const glyph: GlyphData = {
    char,
    codepoint: toCodepointLabel(char),
    canvasSize: 1000,
    widthMode: store.project.glyphs[char]?.widthMode ?? "auto",
    pen: {
      ...penFor(useEditorStore.getState(), char),
      simulatePressure: strokes[0]?.simulatePressure ?? false,
    },
    strokes,
    updatedAt: isoWithOffset(),
  };
  store.saveGlyph(glyph);
  return true;
}
