import { sameFamilyName, sameFamilyNameMessage, uniqueFamilyName } from "../lib/projects/display";
import { DEFAULT_FAMILY_NAME, sanitizeFamilyName } from "../lib/project/project";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { askDialog } from "../store/uiStore";
import { flushProjectSave, listStoredProjects, saveCurrentProjectNow } from "./projects";

/**
 * フォント名を聞いて新しいプロジェクトを作り、保存する。作った ID（キャンセルなら null）。
 * 初期値はほかのプロジェクトと重ならない名前（MyHandwriting2 など）にし、同じ名前を選んだら確かめる
 * （同じ名前のフォントを 2 つインストールすると、あとから入れた方で上書きされるため）
 */
export async function createProjectInteractive(): Promise<string | null> {
  const others = await listStoredProjects();
  let name = uniqueFamilyName(DEFAULT_FAMILY_NAME, others);
  for (;;) {
    const { value, input } = await askDialog({
      title: "フォント名を決めてください",
      message:
        "英数字だけで入力します（あとからヘッダーの「編集」で変えられます）。新しいプロジェクトとして作ります。ほかのプロジェクトと同じ名前にすると、インストールしたときに上書きされます。",
      input: { label: "フォント名", value: name, placeholder: DEFAULT_FAMILY_NAME },
      buttons: [
        { label: "キャンセル", value: "cancel" },
        { label: "はじめる", value: "ok", variant: "primary" },
      ],
      cancelValue: "cancel",
    });
    if (value !== "ok") return null;
    name = sanitizeFamilyName(input) || DEFAULT_FAMILY_NAME;
    const same = sameFamilyName(name, others, null);
    if (same.length === 0) break;
    const answer = await askDialog({
      title: "同じフォント名のプロジェクトがあります",
      message: sameFamilyNameMessage(name, same),
      buttons: [
        { label: "名前を変える", value: "rename" },
        { label: "このまま作る", value: "ok", variant: "primary" },
      ],
      cancelValue: "rename",
    });
    if (answer.value === "ok") break;
  }
  await flushProjectSave();
  useEditorStore.getState().reset();
  const id = useProjectStore.getState().newProject(name);
  await saveCurrentProjectNow();
  return id;
}
