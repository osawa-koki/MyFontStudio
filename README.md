# MyFontStudio

✍️✍️✍️ 自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf / .otf）を作る Web アプリ！

すべての処理はブラウザの中で行い、手書きのデータは外部に送信しない。

## 機能

- 文字列を入力し、1 文字ずつ Canvas に手書きして登録する（マウス・タッチ・ペン。Apple Pencil の筆圧に対応）
- ペンの軌跡（ベクター）から直接フォントの輪郭を作る。重なった線や「口」のような穴も正しく扱う
- .ttf（TrueType。Word で使うならこちら）と .otf（CFF）をダウンロードできる
- 作ったフォントをその場で文章に当てて確かめられる
- 作業を zip に保存して、あとから続きを描ける（ブラウザにも自動保存する）

仕様は [docs/SPEC.md](docs/SPEC.md) を参照。

## 使う

- GitHub Pages：https://osawa-koki.github.io/MyFontStudio/

## 開発

```bash
cd ./frontend/
npm ci
npm run dev
```

| ビルドの環境変数 | 内容 |
|---|---|
| `VITE_ROUTER` | `hash` なら HashRouter（`#/editor`。GitHub Pages 用）。それ以外は BrowserRouter |
| `BASE_PATH` | 配信するパス（既定 `/`。GitHub Pages では `/MyFontStudio/`） |
