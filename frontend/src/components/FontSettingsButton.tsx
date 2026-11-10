import { useRef, useState } from "react";
import { listStoredProjects } from "../features/projects";
import { sameFamilyName, sameFamilyNameMessage } from "../lib/projects/display";
import type { ProjectSummary } from "../lib/projects/repository";
import { FAMILY_NAME_MAX, sanitizeFamilyName } from "../lib/project/project";
import { useProjectStore } from "../store/projectStore";

/** ヘッダーの「編集」。フォント名・日本語名・作者を編集する */
export function FontSettingsButton() {
  const font = useProjectStore((s) => s.project.font);
  const setFontSettings = useProjectStore((s) => s.setFontSettings);
  const ref = useRef<HTMLDialogElement>(null);
  const projectId = useProjectStore((s) => s.projectId);
  const [form, setForm] = useState(font);
  // 同じフォント名のほかのプロジェクトを知らせるため、開いたときに一覧を読む
  const [others, setOthers] = useState<readonly ProjectSummary[]>([]);

  const open = () => {
    setForm(font);
    ref.current?.showModal();
    void listStoredProjects().then(setOthers);
  };
  const same = sameFamilyName(form.familyName, others, projectId);
  const familyValid =
    sanitizeFamilyName(form.familyName) === form.familyName && form.familyName !== "";

  return (
    <>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
        title="フォント名・日本語名・作者を編集"
        aria-label={`フォント名：${font.familyName}（クリックで編集）`}
        onClick={open}
      >
        編集
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
        aria-labelledby="font-settings-title"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            if (!familyValid) {
              e.preventDefault();
              return;
            }
            setFontSettings({
              familyName: form.familyName,
              familyNameJa: form.familyNameJa,
              designer: form.designer,
            });
          }}
        >
          <h2 id="font-settings-title" className="text-lg font-bold">
            フォントの設定
          </h2>
          <label className="flex flex-col gap-1 text-sm">
            フォント名（英数字のみ、{FAMILY_NAME_MAX} 文字まで）
            <input
              className="input"
              value={form.familyName}
              maxLength={FAMILY_NAME_MAX}
              required
              pattern="[A-Za-z0-9]+"
              onChange={(e) => setForm({ ...form, familyName: e.target.value })}
            />
            {!familyValid && (
              <span className="text-xs text-red-600">英数字だけで入力してください</span>
            )}
            {familyValid && same.length > 0 && (
              <span className="text-xs text-amber-800" role="status">
                {sameFamilyNameMessage(form.familyName, same)}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            日本語名（任意。Word のフォント一覧に表示されます）
            <input
              className="input"
              value={form.familyNameJa}
              maxLength={FAMILY_NAME_MAX}
              placeholder="例：大澤手書き"
              onChange={(e) => setForm({ ...form, familyNameJa: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            作者（任意）
            <input
              className="input"
              value={form.designer}
              maxLength={FAMILY_NAME_MAX}
              onChange={(e) => setForm({ ...form, designer: e.target.value })}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={!familyValid}>
              保存
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
