# CLAUDE.md

自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf / .otf）を作る Web アプリ。すべての処理をブラウザの中で行い、サーバー・アカウント・外部への送信はない（静的サイト）。仕様は [docs/SPEC.md](docs/SPEC.md)、使い方と構成は [README.md](README.md) を参照。

- `frontend/`：Vite + React + TypeScript（strict）+ Tailwind CSS の画面（SPA）。コードはすべてここにある
  - `src/lib/`：ロジック（純粋な関数。React に依存させない。テストはここに書く）
    - `project/`：プロジェクトの初期値・名前の直し方・コードポイントの表記
    - `stroke/`：ストロークの記録（丸め・間引き・em 座標への変換・筆圧の決め方）
    - `glyph/`：ストローク → 輪郭 → `GlyphOutline`（仕様 5 章）。`outline.ts` が手順（perfect-freehand → polygon-clipping の union → Douglas–Peucker → 中点の二次ベジェ → フォント座標・向き）、`width.ts` が送り幅（East Asian Width）、`path.ts` が SVG の path、`constants.ts` がメトリクスなどの値
    - `font/`：フォントの生成（仕様 6 章）。`build.ts` が入口（`GlyphOutline[]` とフォントの設定 → ArrayBuffer）、`ttf.ts`（fonteditor-core）・`otf.ts`（opentype.js）がアダプタ、`sfnt.ts` が書き出したあとのテーブルの差し替え（name・OS/2）と書き換え（head・hhea・maxp・post）、`glyphs.ts` が .notdef・スペースを含むグリフの一覧、`spec.ts` が名前とバージョン、`metrics.ts` がメトリクスの値、`fontface.ts` がプレビュー用の FontFace の登録
    - `testing/fixtures.ts`：テスト用の固定のストローク（「口」「十」「。」「A」）
  - `src/store/`：zustand のストア（`projectStore`：プロジェクトの状態、`uiStore`：通知・確認ダイアログ）
  - `src/types/project.ts`：プロジェクト・グリフの型（zip の JSON と同じ形）
  - `src/pages/`・`src/components/`：画面
  - `src/router.tsx`：ルーティング。`VITE_ROUTER=hash` なら HashRouter（GitHub Pages）、それ以外は BrowserRouter
- `Dockerfile`・`nginx/default.conf.template`・`render.yaml`：Node.js でビルド → 非 root の Nginx で配信（SPA のフォールバック・セキュリティヘッダー・CSP・`/healthz`）。Render 用
- `e2e/`：動いているサーバー（コンテナ）に対する Playwright のテスト。応答とヘッダー（`server.spec.ts`）、ブラウザでの操作（`ui.spec.ts`）。`fixtures.ts` の `test` を使うと、コンソールのエラー（CSP の違反など）があれば失敗する
- `docs/SPEC.md`：仕様書。仕様を変えたら、本文と「12. 仕様の修正履歴」を直す
- Node.js のバージョンは `frontend/.node-version` で固定している
- TypeScript は 6.0 系にとどめている（typescript-eslint が 7 に対応していないため。Dependabot でも上げない）

## 開発フロー

作業は必ず **Issue → ブランチ → PR → CI → マージ** の順で進める。小さな修正でも同じ。

1. **Issue を作る**
   - `gh issue create --assignee osawa-koki --title "..." --body-file -`
   - 本文に「概要」と「TODO」（チェックリスト）を書く。
2. **Issue に紐づくブランチを作る**
   - `gh issue develop <番号> --name issues/<番号> --base main`
   - `git fetch origin issues/<番号> && git switch -c issues/<番号> --track origin/issues/<番号>`
   - ブランチ名は `issues/<番号>`。`git switch -c` だけでローカルに作らない（Issue の Development 欄に紐づかないため）。
3. **実装してコミットする**
   - コミットメッセージは「英語の件名＋日本語の本文」。最後のコミットの本文に `Close #<番号>`、途中のコミットには `Refs #<番号>` を入れる。
4. **PR を作る**
   - `gh pr create --assignee osawa-koki --base main --head issues/<番号> --title "..." --body-file -`
   - **Assignees には必ず `osawa-koki` を設定する。**
   - 本文の先頭に `Close #<番号>` を書く（コメントに書いても Issue は自動クローズされない）。
   - 本文は日本語で、「概要」「変更内容」「確認したこと」（実際に確認した内容のチェックリスト）を書く。
5. **CI を確認する**
   - `gh pr checks <PR番号> --watch` で、すべてのジョブの成功を確認する。
6. **自分で確認してマージする**
   - PR を作ったら、ユーザーの指示を待たずにマージまで進める。
   - マージの前に、CI がすべて成功したことと、差分（`gh pr diff <PR番号>`）が Issue の TODO を満たし、余計な変更がないことを確かめ、PR 本文の「確認したこと」を更新する。CI が失敗した・確かめきれないことがあるときは、マージせずにユーザーに伝える。
   - `gh pr merge <PR番号> --merge`（マージコミット）。ブランチは消さない。
   - マージ後は `main` の CI・デプロイの結果を確認する。

PR は役割ごとに分ける。前の PR に依存する場合は、マージ後の `main` から次のブランチを切る。

## 検証コマンド

```bash
# 画面（frontend/ で）
npm run typecheck
npm run lint            # ESLint と Prettier（直すときは npm run format）
npm run test:coverage   # 単体テストとカバレッジの下限（vite.config.ts の coverage.thresholds）
npm run build
npm run dev             # 開発サーバー

# 生成したフォントの確認（frontend/ で。fontTools と OTS が要る）
python3 -m venv /tmp/fontcheck && /tmp/fontcheck/bin/pip install -r scripts/requirements-fonts.txt
npm run fonts:sample    # 固定のストロークから out/Sample.ttf・out/Sample.otf を作る
/tmp/fontcheck/bin/python scripts/check-fonts.py out/Sample.ttf out/Sample.otf
/tmp/fontcheck/bin/ttx -t name -t OS/2 -o - out/Sample.ttf   # テーブルの中身を見る

# Docker と E2E（リポジトリのルートで）
docker build -t myfontstudio .
docker run -d --name app -e PORT=8080 -p 8080:8080 myfontstudio
cd ./e2e/ && npm ci && npx playwright install chromium
npm run typecheck
BASE_URL=http://localhost:8080 npm test
docker rm -f app
```

- フォントの生成（`lib/font`・`lib/glyph`）を変えたら、上の fontTools・OTS の確認を実行する（CI でも実行する）。opentype.js は Vite では ESM、Node（tsx・Vitest）では UMD として読まれるので、`otf.ts` のように両方に対応させる。
- 画面の変更は、`e2e/ui.spec.ts` で操作を確かめる。CSP（`script-src 'self'`・`style-src 'self'`）に違反しないよう、インラインのスクリプト・`<style>`・HTML の `style` 属性を使わない（React の `style` プロパティは CSSOM で設定されるので使ってよい）。

## CI（GitHub Actions）

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `frontend-ci.yml` | すべての PR | 型チェック、ESLint・Prettier、単体テストとカバレッジ（`lib/`・`store/` の行の 85% が下限）、生成したフォントの確認（fontTools・OTS）、ビルド（BrowserRouter と HashRouter の 2 通り） |
| `docker-ci.yml` | すべての PR | E2E テストの型チェック。イメージをビルドしてコンテナを起動し、Playwright のテストを実行する（失敗したらレポートをアーティファクトに残す） |
| `audit.yml` | `frontend/package*.json` を変えた PR、週 1 回（月曜 3:30 JST）、手動 | `npm audit --omit=dev --audit-level=high`（画面に入る依存。開発用を含む結果はサマリーに出すだけ） |

- actions は、すべてコミットの SHA で固定し、行の終わりにバージョンを書く（例：`uses: actions/checkout@<40 文字の SHA> # v7.0.1`）。SHA は `gh api repos/<owner>/<repo>/commits/<タグ> --jq .sha` で調べる。
- ワークフローを変えたら actionlint で確認する（`docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -no-color`）。
- すべてのジョブに `timeout-minutes` を付ける。
- Dependabot（`.github/dependabot.yml`）は github-actions・npm（`frontend/`・`e2e/`）・pip（`frontend/scripts/requirements-fonts.txt`）・docker（`Dockerfile` の Nginx。ダイジェストで固定している）を週 1 回更新する。minor・patch はエコシステムごとに 1 つの PR にまとめる。Node.js（`frontend/.node-version` と `Dockerfile` の `node`）は対象外なので、上げるときは手で 2 つをそろえる。

### デプロイ

| 先 | トリガー | 内容 |
|---|---|---|
| Render | `main` への push のうち、`frontend/`・`nginx/`・`Dockerfile`・`.dockerignore` が変わったとき（Render 側の自動デプロイ、`render.yaml` の `buildFilter`） | `render.yaml` の設定で Docker イメージをビルドして動かす |
| GitHub Pages（https://osawa-koki.github.io/MyFontStudio/ ） | `main` への push のうち、`frontend/`・`pages.yml` が変わったとき、手動（`pages.yml`） | `VITE_ROUTER=hash`・`BASE_PATH=/MyFontStudio/` でビルドしてデプロイする |

- GitHub Pages では HTTP ヘッダー（CSP など）を付けられない。セキュリティヘッダーは Nginx（Render）でだけ付く。
- 画面を変えた PR のマージ後は、`pages.yml` の結果を確認する（`gh run list --workflow pages.yml --branch main --limit 1` → `gh run watch <run-id> --exit-status`）。

## 設計上の約束ごと

- **ブラウザの外にデータを送らない**：手書きのデータを外部に送る処理・アクセス解析・外部 CDN を入れない。フォントやライブラリはすべてバンドルする。
- **ロジックは `frontend/src/lib/` に純粋な関数で書く**：React に依存させず、Vitest で単体テストする。画面（`pages/`・`components/`）は `lib/` を呼ぶだけにする。
- **同じ入力から同じフォント**：ストローク → グリフの変換（`lib/glyph`）は決定的な純粋関数にする。zip から復元したときも同じ処理でフォントを作り直す。復元の正はベクター JSON（zip の中の .ttf / .otf・PNG は読み込みに使わない）。
- **.ttf と .otf は同じ中間データから作る**：`GlyphOutline` と `FontSpec` を受け取り ArrayBuffer を返す。形式ごとの違いはアダプタ（`lib/font/ttf.ts`・`lib/font/otf.ts`）に閉じ込める。名前・メトリクス・OS/2 の値は、ライブラリで書き出したあとに `lib/font/sfnt.ts` でテーブルを差し替えて、両形式でそろえる（仕様 6.4）。
- **座標**：Canvas とストロークは 0〜1000 の em 座標（y 下向き）。フォント座標は `fontX = x`、`fontY = 880 - y`（y 上向き、ベースライン 0）。
- **zip のデータ形式**（`project.json`・ベクター JSON）を変えるときは `formatVersion` を上げ、古い形式のマイグレーションを書く。
