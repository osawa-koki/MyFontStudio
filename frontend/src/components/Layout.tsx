import { Outlet } from "react-router";
import { DialogHost } from "./DialogHost";
import { Header } from "./Header";
import { Toasts } from "./Toasts";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        MyFontStudio — 手書きのデータはブラウザの外に送信されません
      </footer>
      <Toasts />
      <DialogHost />
    </div>
  );
}
