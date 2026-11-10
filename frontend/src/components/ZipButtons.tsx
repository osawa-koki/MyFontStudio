import { useState } from "react";
import { NO_PROJECT_MESSAGE, saveZip } from "../features/archiveActions";
import { useProjectStore } from "../store/projectStore";

/** ヘッダーの「zip で保存」（読み込みはプロジェクトの切り替えメニューから） */
export function ZipButtons() {
  const [busy, setBusy] = useState(false);
  // プロジェクトを開いていなければ、保存するものがない
  const hasProject = useProjectStore((s) => s.projectId !== null);
  return (
    <button
      type="button"
      className="btn"
      title={hasProject ? "Ctrl/⌘+Shift+S" : NO_PROJECT_MESSAGE}
      disabled={busy || !hasProject}
      onClick={() => {
        setBusy(true);
        void saveZip().finally(() => setBusy(false));
      }}
    >
      zip で保存
    </button>
  );
}
