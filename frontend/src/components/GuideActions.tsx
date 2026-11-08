"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { openZip } from "../features/archiveActions";
import { DEFAULT_FAMILY_NAME, sanitizeFamilyName } from "../lib/project/project";
import { useProjectStore } from "../store/projectStore";
import { askDialog, confirmDialog } from "../store/uiStore";

/** 使い方ページのボタン：新しくはじめる・zip を開いて続きから・作業を続ける */
export function GuideActions() {
  const router = useRouter();
  const started = useProjectStore((s) => s.started);
  const dirty = useProjectStore((s) => s.dirty);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = async () => {
    if (started && dirty) {
      const ok = await confirmDialog(
        "新しくはじめますか？",
        "zip に保存していない変更があります。新しくはじめると、今の作業は失われます。",
        "新しくはじめる",
        "danger",
      );
      if (!ok) return;
    }
    const { value, input } = await askDialog({
      title: "フォント名を決めてください",
      message: "英数字だけで入力します（あとからヘッダーで変えられます）。",
      input: { label: "フォント名", value: DEFAULT_FAMILY_NAME, placeholder: DEFAULT_FAMILY_NAME },
      buttons: [
        { label: "キャンセル", value: "cancel" },
        { label: "はじめる", value: "ok", variant: "primary" },
      ],
      cancelValue: "cancel",
    });
    if (value !== "ok") return;
    useProjectStore.getState().newProject(sanitizeFamilyName(input) || DEFAULT_FAMILY_NAME);
    router.push("/editor");
  };

  return (
    <div className="flex flex-wrap gap-3">
      {started && (
        <button type="button" className="btn btn-primary" onClick={() => router.push("/editor")}>
          作業を続ける
        </button>
      )}
      <button
        type="button"
        className={started ? "btn" : "btn btn-primary"}
        onClick={() => void start()}
      >
        新しくはじめる
      </button>
      <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
        zip を開いて続きから
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        aria-label="続きから開く zip ファイルを選ぶ"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            void openZip(file).then((ok) => {
              if (ok) router.push("/editor");
            });
          }
        }}
      />
    </div>
  );
}
