import { DEFAULT_FAMILY_NAME, sanitizeFamilyName } from "../lib/project/project";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { askDialog } from "../store/uiStore";
import { flushProjectSave, saveCurrentProjectNow } from "./projects";

/** フォント名を聞いて新しいプロジェクトを作り、保存する。作った ID（キャンセルなら null） */
export async function createProjectInteractive(): Promise<string | null> {
  const { value, input } = await askDialog({
    title: "フォント名を決めてください",
    message:
      "英数字だけで入力します（あとからヘッダーの「編集」で変えられます）。新しいプロジェクトとして作ります。",
    input: { label: "フォント名", value: DEFAULT_FAMILY_NAME, placeholder: DEFAULT_FAMILY_NAME },
    buttons: [
      { label: "キャンセル", value: "cancel" },
      { label: "はじめる", value: "ok", variant: "primary" },
    ],
    cancelValue: "cancel",
  });
  if (value !== "ok") return null;
  await flushProjectSave();
  useEditorStore.getState().reset();
  const id = useProjectStore
    .getState()
    .newProject(sanitizeFamilyName(input) || DEFAULT_FAMILY_NAME);
  await saveCurrentProjectNow();
  return id;
}
