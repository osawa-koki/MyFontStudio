import { useState } from "react";
import { saveZip } from "../features/archiveActions";
import { LOCKED_OUT_MESSAGE, useLockedOut } from "../store/tabLockStore";
import { useBusyMessage } from "../store/taskStore";

/** ヘッダーの「zip で保存」（読み込みはプロジェクトの切り替えメニューから） */
export function ZipButtons() {
  const [busy, setBusy] = useState(false);
  const lockedOut = useLockedOut();
  // ほかの重い処理（フォントのダウンロード・zip の読み込み）が動いている間は押せない
  const busyTask = useBusyMessage();
  return (
    <button
      type="button"
      className="btn"
      title={lockedOut ? LOCKED_OUT_MESSAGE : (busyTask ?? "Ctrl/⌘+Shift+S")}
      disabled={busy || lockedOut || busyTask !== null}
      onClick={() => {
        setBusy(true);
        void saveZip().finally(() => setBusy(false));
      }}
    >
      zip で保存
    </button>
  );
}
