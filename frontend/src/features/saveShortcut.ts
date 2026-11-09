import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { saveShortcut } from "../lib/shortcuts";
import { saveZip } from "./archiveActions";

const dialogOpen = () => document.querySelector("dialog[open]") !== null;

/**
 * 保存のショートカット（AppShell で 1 回だけ使う）。ブラウザ標準の「ページを保存」は止める
 * - Cmd/Ctrl+Shift+S：どのページでも「zip で保存」
 * - Cmd/Ctrl+S：入力ページでは編集中の文字の保存（入力ページが受け持つ）、それ以外のページでは「zip で保存」
 * テキスト入力中も効かせる（テキストの編集と重ならないため）。ダイアログが開いているときは効かせない
 */
export function useSaveShortcut(): void {
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const kind = saveShortcut(e);
      if (!kind) return;
      e.preventDefault();
      if (dialogOpen()) return;
      const onEditor = pathname.startsWith("/editor");
      if (kind === "saveZip" || !onEditor) void saveZip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);
}
