import { useState } from "react";
import { saveZip } from "../features/archiveActions";
import { LOCKED_OUT_MESSAGE, useLockedOut } from "../store/tabLockStore";

/** ヘッダーの「zip で保存」（読み込みはプロジェクトの切り替えメニューから） */
export function ZipButtons() {
  const [busy, setBusy] = useState(false);
  const lockedOut = useLockedOut();
  return (
    <button
      type="button"
      className="btn"
      title={lockedOut ? LOCKED_OUT_MESSAGE : "Ctrl/⌘+Shift+S"}
      disabled={busy || lockedOut}
      onClick={() => {
        setBusy(true);
        void saveZip().finally(() => setBusy(false));
      }}
    >
      zip で保存
    </button>
  );
}
