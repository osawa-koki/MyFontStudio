"use client";

import type { ReactNode } from "react";
import { useAutosave } from "../features/autosave";
import { useFontPreview } from "../features/fontPreview";
import { useZipDrop } from "../features/zipDrop";
import { DialogHost } from "./DialogHost";
import { Header } from "./Header";
import { Toasts } from "./Toasts";

/** すべてのページの共通の外枠（ヘッダー・通知・ダイアログ）。プレビュー用のフォントの生成と zip のドロップもここで扱う */
export function AppShell({ children }: { children: ReactNode }) {
  useFontPreview();
  useAutosave();
  useZipDrop();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        MyFontStudio — 手書きのデータはブラウザの外に送信されません
      </footer>
      <Toasts />
      <DialogHost />
    </div>
  );
}
