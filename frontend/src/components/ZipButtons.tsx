import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openZip, saveZip } from "../features/archiveActions";

/** ヘッダーの「zip で保存」「zip を開く」 */
export function ZipButtons() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => void run(saveZip)}>
        zip で保存
      </button>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        zip を開く
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        data-testid="zip-input"
        aria-label="zip ファイルを選ぶ"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            void run(async () => {
              if (await openZip(file)) router.push("/editor");
            });
          }
        }}
      />
    </>
  );
}
