// Nginx の CSP の script-src に入れる設定（インラインのスクリプトのハッシュ）を書き出す。Dockerfile のビルドで実行する。
// 使い方：node scripts/csp-hashes.mjs out > csp.conf
import { inlineScriptHashes } from "./csp.mjs";

const root = process.argv[2] ?? "out";
const hashes = inlineScriptHashes(root);
process.stderr.write(`インラインのスクリプトのハッシュ ${hashes.length} 個\n`);
process.stdout.write(`set $csp_script_src "'self' ${hashes.join(" ")}";\n`);
