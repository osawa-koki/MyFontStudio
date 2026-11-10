import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * Web Worker のファイル名（npm run build:worker が中身のハッシュを付けて作り、.worker.json に書く）。
 * まだ作っていないとき（型チェックの next typegen など）は仮の名前にする
 */
function workerFile(): string {
  try {
    const { file } = JSON.parse(readFileSync(".worker.json", "utf8")) as { file?: unknown };
    if (typeof file === "string" && /^font\.worker-[A-Za-z0-9]+\.js$/.test(file)) return file;
  } catch {
    // まだ作っていない
  }
  return "font.worker.js";
}

const nextConfig: NextConfig = {
  // サーバーを持たない静的サイト（手書きのデータを外部に送らない）。next build で out/ に HTML などを書き出す
  output: "export",
  // 配信するパス。GitHub Pages では /MyFontStudio（pages.yml で BASE_PATH を渡す）、Docker（Nginx）ではルート
  basePath: process.env.BASE_PATH || undefined,
  // Web Worker（public/workers/）の URL に付ける。basePath は public のファイルの URL に自動では付かないため
  // Worker のファイル名（中身のハッシュ付き）も埋め込む
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "",
    NEXT_PUBLIC_WORKER_FILE: workerFile(),
  },
  // /editor/ → editor/index.html。false だと editor.html と editor/（RSC のデータ）が並び、
  // GitHub Pages が /editor をディレクトリとみなして 404 になる
  trailingSlash: true,
  images: { unoptimized: true },
  // 画面に「Powered by」などのヘッダーは付けない（静的エクスポートでは関係ないが念のため）
  poweredByHeader: false,
};

export default nextConfig;
