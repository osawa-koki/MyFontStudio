// 静的エクスポートした HTML の CSP（Nginx と GitHub Pages で共通。CSP の中身はここだけに書く）。
// Next.js が HTML に埋め込むインラインのスクリプトは、SHA-256 のハッシュで許可する（'unsafe-inline' にしない）
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

/** root の下の HTML ファイル（相対パス） */
export function htmlFiles(root) {
  const files = readdirSync(root, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"));
  if (files.length === 0) throw new Error(`${root} に HTML がない`);
  return files;
}

/** インラインのスクリプトの SHA-256（'sha256-…' の形、並べ替え済み） */
export function inlineScriptHashes(root) {
  const hashes = new Set();
  for (const f of htmlFiles(root)) {
    for (const [, body] of readFileSync(join(root, f), "utf8").matchAll(INLINE_SCRIPT)) {
      hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
    }
  }
  return [...hashes].sort();
}

/**
 * CSP。外部への通信を一切させない（手書きのデータをブラウザの外に出さない）。FontFace・Canvas・ダウンロードで blob: / data: を使う。
 * meta：<meta> で使うとき（frame-ancestors は <meta> では効かないので入れない）
 */
export function contentSecurityPolicy(scriptSrc, { meta = false } = {}) {
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    ...(meta ? [] : ["frame-ancestors 'none'"]),
  ].join("; ");
}
