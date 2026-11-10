import { isoWithOffset } from "../lib/project/chars";
import { toCodepointLabel } from "../lib/project/project";
import { isDirty, strokesOf } from "../lib/stroke/history";
import { historyFor, penFor, useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import type { GlyphData, GlyphPen } from "../types/project";

const samePen = (a: GlyphPen, b: GlyphPen) =>
  a.size === b.size &&
  a.thinning === b.thinning &&
  a.smoothing === b.smoothing &&
  a.streamline === b.streamline &&
  a.simulatePressure === b.simulatePressure;

/**
 * 描いた線を、その文字のグリフとして保存する（保存時点のペンを記録する）。線がなければ false。
 * 線もペンも保存済みのグリフと同じなら、保存し直さない（「zip 未保存」・更新日時を変えない）が true を返す
 * （呼び出し側は次の文字へ進む）。ペンだけを変えたときは、文字全体の見た目が変わるので保存し直す。
 * 描いた履歴はそのまま残すので、保存したあとも元に戻す・やり直しができる
 */
export function commitDraft(char: string): boolean {
  const history = historyFor(char);
  const strokes = strokesOf(history);
  if (strokes.length === 0) return false;
  const store = useProjectStore.getState();
  const saved = store.project.glyphs[char];
  const pen: GlyphPen = {
    ...penFor(useEditorStore.getState(), char),
    simulatePressure: strokes[0]?.simulatePressure ?? false,
  };
  if (saved && !isDirty(history, saved.strokes) && samePen(saved.pen, pen)) return true;
  const glyph: GlyphData = {
    char,
    codepoint: toCodepointLabel(char),
    canvasSize: 1000,
    widthMode: saved?.widthMode ?? "auto",
    pen,
    strokes,
    updatedAt: isoWithOffset(),
  };
  store.saveGlyph(glyph);
  return true;
}
