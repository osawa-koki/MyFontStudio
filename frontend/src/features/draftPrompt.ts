import { askDialog } from "../store/uiStore";
import { commitDraft } from "./glyphActions";
import { unsavedDraftChars } from "./unsavedWarning";

/**
 * グリフとして保存していない描きかけの線があれば、先に保存するか確かめる（zip の保存・フォントのダウンロードの前）。
 * note：「保存しない」を選んだときにどうなるか。キャンセルしたら false
 */
export async function confirmCommitDrafts(note: string): Promise<boolean> {
  const drafts = unsavedDraftChars();
  if (drafts.length === 0) return true;
  const { value } = await askDialog({
    title: "この文字も保存しますか？",
    message: `グリフとして保存していない描きかけの線があります：${drafts.join(" ")}（${note}）`,
    buttons: [
      { label: "キャンセル", value: "cancel" },
      { label: "保存しない", value: "skip" },
      { label: "保存する", value: "save", variant: "primary" },
    ],
    cancelValue: "cancel",
  });
  if (value === "cancel") return false;
  if (value === "save") drafts.forEach(commitDraft);
  return true;
}
