import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバーを持たない静的サイト（手書きのデータを外部に送らない）。next build で out/ に HTML などを書き出す
  output: "export",
  // 配信するパス。GitHub Pages では /MyFontStudio（pages.yml で BASE_PATH を渡す）、Docker（Nginx）ではルート
  basePath: process.env.BASE_PATH || undefined,
  // Web Worker（public/workers/）の URL に付ける。basePath は public のファイルの URL に自動では付かないため
  env: { NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "" },
  // /editor/ → editor/index.html。false だと editor.html と editor/（RSC のデータ）が並び、
  // GitHub Pages が /editor をディレクトリとみなして 404 になる
  trailingSlash: true,
  images: { unoptimized: true },
  // 画面に「Powered by」などのヘッダーは付けない（静的エクスポートでは関係ないが念のため）
  poweredByHeader: false,
};

export default nextConfig;
