import { strokesOf } from "../lib/stroke/history";
import { historyFor } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { askDialog } from "../store/uiStore";
import { commitDraft } from "./glyphActions";
import { unsavedDraftChars } from "./unsavedWarning";

/**
 * グリフとして保存していない文字を、描きかけの文字と、線をすべて消した作成済みの文字
 * （保存すると字形が消えて未作成に戻る文字）に分ける
 */
export function splitDrafts(chars: readonly string[]): { drafts: string[]; reverts: string[] } {
  const { glyphs } = useProjectStore.getState().project;
  const drafts: string[] = [];
  const reverts: string[] = [];
  for (const c of chars) {
    if (glyphs[c] && strokesOf(historyFor(c)).length === 0) reverts.push(c);
    else drafts.push(c);
  }
  return { drafts, reverts };
}

/**
 * グリフとして保存していない描きかけの線があれば、先に保存するか確かめる（zip の保存・フォントのダウンロードの前）。
 * 線をすべて消した作成済みの文字は、「保存する」で未作成に戻り、フォントから消えることを分けて示す。
 * note：「保存しない」を選んだときにどうなるか。キャンセルしたら false
 */
export async function confirmCommitDrafts(note: string): Promise<boolean> {
  const all = unsavedDraftChars();
  if (all.length === 0) return true;
  const { drafts, reverts } = splitDrafts(all);
  const lines = [
    drafts.length > 0
      ? `グリフとして保存していない描きかけの線があります：${drafts.join(" ")}`
      : null,
    reverts.length > 0
      ? `線をすべて消した作成済みの文字があります：${reverts.join(" ")}（「保存する」を選ぶと、字形を消して未作成に戻します。フォントからも消えます）`
      : null,
    `（${note}）`,
  ];
  const { value } = await askDialog({
    title: "この文字も保存しますか？",
    message: lines.filter(Boolean).join("\n"),
    buttons: [
      { label: "キャンセル", value: "cancel" },
      { label: "保存しない", value: "skip" },
      { label: "保存する", value: "save", variant: "primary" },
    ],
    cancelValue: "cancel",
  });
  if (value === "cancel") return false;
  if (value === "save") all.forEach(commitDraft);
  return true;
}
