// Nginx の CSP の設定を書き出す。Dockerfile のビルドで実行し、/etc/nginx/csp.conf に置く（default.conf.template が include する）。
// CSP の中身は csp.mjs の contentSecurityPolicy() だけに書き（GitHub Pages の <meta> と同じ）、
// script-src にインラインのスクリプトのハッシュを入れる。
// 使い方：node scripts/csp-hashes.mjs out > csp.conf
import { contentSecurityPolicy, inlineScriptHashes } from "./csp.mjs";

const root = process.argv[2] ?? "out";
const hashes = inlineScriptHashes(root);
const policy = contentSecurityPolicy(`'self' ${hashes.join(" ")}`);
// Nginx の文字列に入れるので、" と $ を含まないことを確かめる（CSP の値には現れない）
if (/["$\\]/.test(policy))
  throw new Error(`CSP に Nginx の文字列に入れられない文字がある：${policy}`);
process.stderr.write(`インラインのスクリプトのハッシュ ${hashes.length} 個\n`);
process.stdout.write(`set $csp "${policy}";\n`);
