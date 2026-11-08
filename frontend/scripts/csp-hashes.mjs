// 静的エクスポートした HTML のインラインのスクリプト（Next.js が埋め込む）の SHA-256 を集め、
// Nginx の CSP の script-src に入れる設定を書き出す。Dockerfile のビルドで実行する。
// 使い方：node scripts/csp-hashes.mjs out > csp.conf
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "out";
const files = readdirSync(root, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".html"));
const hashes = new Set();
const inline = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
for (const f of files) {
  for (const [, body] of readFileSync(join(root, f), "utf8").matchAll(inline)) {
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
}
if (files.length === 0) throw new Error(`${root} に HTML がない`);
process.stderr.write(
  `${files.length} 個の HTML から ${hashes.size} 個のインラインのスクリプトのハッシュ\n`,
);
process.stdout.write(`set $csp_script_src "'self' ${[...hashes].sort().join(" ")}";\n`);
