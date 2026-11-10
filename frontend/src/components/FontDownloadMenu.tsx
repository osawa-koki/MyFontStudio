import { downloadFont } from "../features/actions";
import { countGlyphs } from "../lib/project/project";
import { useProjectStore } from "../store/projectStore";
import { LOCKED_OUT_MESSAGE, useLockedOut } from "../store/tabLockStore";
import { useMenuButton } from "./useMenuButton";

const ITEM =
  "rounded px-3 py-2 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none";

/** ヘッダーの「フォントをダウンロード」（.ttf / .otf を選ぶ。既定は .ttf） */
export function FontDownloadMenu() {
  // 作成済みのグリフがあれば使える（プレビュー用のフォントの生成とは関係なく、ダウンロードのときに作る）
  const glyphCount = useProjectStore((s) => countGlyphs(s.project));
  const { open, toggle, close, rootRef, buttonRef, menuRef, onButtonKeyDown, onMenuKeyDown } =
    useMenuButton();
  const lockedOut = useLockedOut();
  const disabled = glyphCount === 0 || lockedOut;
  const pick = (format: "ttf" | "otf") => {
    close();
    void downloadFont(format);
  };
  return (
    <div ref={rootRef} className="relative flex">
      <button
        type="button"
        className="btn btn-primary rounded-r-none"
        disabled={disabled}
        title={
          lockedOut
            ? LOCKED_OUT_MESSAGE
            : glyphCount === 0
              ? "まだ文字がありません"
              : "Word で使うなら .ttf"
        }
        onClick={() => void downloadFont("ttf")}
      >
        フォントをダウンロード（.ttf）
      </button>
      <button
        type="button"
        className="btn btn-primary rounded-l-none border-l-blue-500 px-2"
        aria-label="形式を選んでダウンロード"
        disabled={disabled}
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onKeyDown={onButtonKeyDown}
        onClick={toggle}
      >
        ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          aria-label="ダウンロードする形式"
          className="absolute top-full right-0 z-50 mt-1 flex w-56 flex-col rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={ITEM}
            onClick={() => pick("ttf")}
          >
            .ttf（Word 向け・推奨）
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={ITEM}
            onClick={() => pick("otf")}
          >
            .otf
          </button>
        </div>
      )}
    </div>
  );
}
