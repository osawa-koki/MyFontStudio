import { useRef } from "react";
import { downloadFont } from "../app/actions";
import { useFontStore } from "../store/fontStore";

/** ヘッダーの「フォントをダウンロード」（.ttf / .otf を選ぶ。既定は .ttf） */
export function FontDownloadMenu() {
  const outlineCount = useFontStore((s) => s.outlineCount);
  const ref = useRef<HTMLDetailsElement>(null);
  const disabled = outlineCount === 0;
  const pick = (format: "ttf" | "otf") => {
    if (ref.current) ref.current.open = false;
    void downloadFont(format);
  };
  return (
    <div className="flex">
      <button
        type="button"
        className="btn btn-primary rounded-r-none"
        disabled={disabled}
        title={disabled ? "まだ文字がありません" : "Word で使うなら .ttf"}
        onClick={() => void downloadFont("ttf")}
      >
        フォントをダウンロード（.ttf）
      </button>
      <details ref={ref} className="relative">
        <summary
          className={`btn btn-primary list-none rounded-l-none border-l-blue-500 px-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}
          aria-label="形式を選ぶ"
          aria-disabled={disabled}
        >
          ▾
        </summary>
        <div className="absolute right-0 z-50 mt-1 flex w-56 flex-col rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
          <button
            type="button"
            className="rounded px-3 py-2 text-left hover:bg-slate-100"
            onClick={() => pick("ttf")}
          >
            .ttf（Word 向け・推奨）
          </button>
          <button
            type="button"
            className="rounded px-3 py-2 text-left hover:bg-slate-100"
            onClick={() => pick("otf")}
          >
            .otf
          </button>
        </div>
      </details>
    </div>
  );
}
