import { useState } from "react";
import { NO_PROJECT_MESSAGE, saveZip } from "../features/archiveActions";
import { useProjectStore } from "../store/projectStore";
import { LOCKED_OUT_MESSAGE, useLockedOut } from "../store/tabLockStore";

/** ヘッダーの「zip で保存」（読み込みはプロジェクトの切り替えメニューから） */
export function ZipButtons() {
  const [busy, setBusy] = useState(false);
  // プロジェクトを開いていなければ、保存するものがない
  const hasProject = useProjectStore((s) => s.projectId !== null);
  const lockedOut = useLockedOut();
  return (
    <button
      type="button"
      className="btn"
      title={!hasProject ? NO_PROJECT_MESSAGE : lockedOut ? LOCKED_OUT_MESSAGE : "Ctrl/⌘+Shift+S"}
      disabled={busy || !hasProject || lockedOut}
      onClick={() => {
        setBusy(true);
        void saveZip().finally(() => setBusy(false));
      }}
    >
      zip で保存
    </button>
  );
}
