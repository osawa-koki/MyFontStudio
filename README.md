# MyFontStudio

✍️✍️✍️ 自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf / .otf）を作る Web アプリ！

すべての処理はブラウザの中で行い、手書きのデータは外部に送信しない。

## 機能

- 文字列を入力し、1 文字ずつ Canvas に手書きして登録する（マウス・タッチ・ペン。Apple Pencil の筆圧に対応）
- ペンの軌跡（ベクター）から直接フォントの輪郭を作る。重なった線や「口」のような穴も正しく扱う
- .ttf（TrueType。Word で使うならこちら）と .otf（CFF）をダウンロードできる
- 作ったフォントをその場で文章に当てて確かめられる
- 作業を zip に保存して、あとから続きを描ける（ブラウザにも自動保存する）

## 画面

| ページ | 内容 |
|---|---|
| 使い方（`/`） | 新しくはじめる・zip を開く・このブラウザのプロジェクトの一覧、手順・描くコツ・途中保存・フォントのインストール方法・Word で使うときの注意・よくある質問 |
| 入力（`/editor/?uuid=xxx`） | 文字列の入力・プリセット（ひらがな・カタカナ・数字・英字・記号）、文字一覧、手書きの Canvas（ガイド・お手本・筆圧・元に戻す/やり直し）、保存して次の文字へ |
| プレビュー（`/preview/?uuid=xxx`） | 入力した文章を生成したフォントで表示（文字サイズ・行間・色・縦書き・罫線、未作成の文字の表示の切り替え）、.ttf / .otf のダウンロード |

- 複数のプロジェクト（フォント）を持てる。プロジェクトごとに UUID を振ってブラウザ（IndexedDB）に自動で保存し、`/editor/?uuid=xxx` で開く。ヘッダーのメニューで切り替え・新規作成・ZIP の読み込みができ、使い方ページに一覧（開く・削除）と保存の状態（永続化・使用量）がある
- 作業は zip（`project.json`・フォント・ストロークのベクター JSON・プレビュー PNG）に保存でき、zip を開くと新しいプロジェクトとして読み込む
- フォントは .ttf（fonteditor-core、TrueType）と .otf（opentype.js、CFF）。名前（日本語名を含む）・メトリクス・OS/2 の値は両形式でそろえ、fontTools・OTS で確かめている

仕様は [docs/SPEC.md](docs/SPEC.md) を参照。

## 構成

| ディレクトリ | 役割 | 技術 |
|---|---|---|
| `frontend/` | 画面（静的エクスポート）とロジック | Next.js（App Router）/ React / TypeScript / Tailwind CSS / zustand / Vitest |
| `e2e/` | 配信したサイトに対する E2E テスト | Playwright |
| `Dockerfile`・`nginx/` | 静的ファイルを Nginx で配信する（セキュリティヘッダー・CSP） | Docker / Nginx |

## 使う

- GitHub Pages：https://osawa-koki.github.io/MyFontStudio/
- Docker：`docker run --rm -p 8080:8080 ghcr.io/osawa-koki/myfontstudio:main` → http://localhost:8080/（`main` へのマージで GitHub Container Registry にプッシュしている。手元でビルドするなら `docker build -t myfontstudio .`）
  - Nginx で配信する（待ち受けるポートは環境変数 `PORT`、既定 8080）。Render には `render.yaml` の Blueprint でデプロイできる

## 開発

```bash
cd ./frontend/
npm ci
npm run dev
```

Next.js（App Router）の静的エクスポートで、`npm run build` すると `out/` にページごとの HTML などができる（サーバーは要らない）。

| ビルドの環境変数 | 内容 |
|---|---|
| `BASE_PATH` | 配信するパス（Next.js の `basePath`。既定はルート。GitHub Pages では `/MyFontStudio`） |
