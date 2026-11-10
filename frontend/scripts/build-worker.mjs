// Web Worker（src/workers/font.worker.ts）を esbuild で public/workers/ にバンドルする（npm run build:worker。build・dev の前に自動で実行）。
// ファイル名に中身のハッシュを付け（font.worker-XXXXXXXX.js）、デプロイをまたいで古い画面と新しい Worker が組み合わさらないようにする。
// 画面からは next.config.ts が .worker.json を読み、NEXT_PUBLIC_WORKER_FILE で URL を埋め込む
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const outdir = "public/workers";
// 前のビルドのファイルを残さない
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
const result = await build({
  entryPoints: ["src/workers/font.worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  logLevel: "warning",
  outdir,
  entryNames: "[name]-[hash]",
  metafile: true,
});
const file = Object.keys(result.metafile.outputs).find((f) => f.endsWith(".js"));
if (!file) throw new Error("Worker のバンドルがない");
writeFileSync(".worker.json", JSON.stringify({ file: basename(file) }) + "\n");
process.stderr.write(`Worker：${outdir}/${basename(file)}\n`);
