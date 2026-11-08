import { useState } from "react";
import { saveZip } from "../features/archiveActions";

/** ヘッダーの「zip で保存」（読み込みはプロジェクトの切り替えメニューから） */
export function ZipButtons() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void saveZip().finally(() => setBusy(false));
      }}
    >
      zip で保存
    </button>
  );
}
