import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "MyFontStudio - 手書きフォント作成", template: "%s | MyFontStudio" },
  description:
    "自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf / .otf）を作る。データはブラウザの外に送信しない。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
