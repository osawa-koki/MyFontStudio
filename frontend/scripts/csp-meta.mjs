// GitHub Pages は HTTP ヘッダーを付けられないので、HTML の <head> の先頭に CSP の <meta> を入れる。pages.yml のビルドで実行する。
// 使い方：node scripts/csp-meta.mjs out
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentSecurityPolicy, htmlFiles, inlineScriptHashes } from "./csp.mjs";

const root = process.argv[2] ?? "out";
// ハッシュは <meta> を入れる前に集める（<meta> を入れてもスクリプトの中身は変わらない）
const policy = contentSecurityPolicy(`'self' ${inlineScriptHashes(root).join(" ")}`, { meta: true });
const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;
const files = htmlFiles(root);
for (const f of files) {
  const path = join(root, f);
  const html = readFileSync(path, "utf8");
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const i = html.indexOf("<head>");
  if (i < 0) throw new Error(`${f} に <head> がない`);
  writeFileSync(path, html.slice(0, i + 6) + tag + html.slice(i + 6));
}
process.stderr.write(`${files.length} 個の HTML に CSP の <meta> を入れた\n`);
