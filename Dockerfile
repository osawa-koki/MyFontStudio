# ---- 画面（Next.js の静的エクスポート）のビルド ----
# 書き出すのは静的ファイル（アーキテクチャによらない）なので、ビルドするマシンのアーキテクチャで動かす
# （arm64 のイメージを作るときも、エミュレーションで Next.js をビルドしない）
FROM --platform=$BUILDPLATFORM node:26-alpine AS web-builder
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# out/ に HTML などを書き出し、インラインのスクリプトのハッシュを CSP 用に集める
RUN npm run build \
    && node scripts/csp-hashes.mjs out > /app/csp.conf

# ---- 実行（Nginx で静的ファイルを配信） ----
# root でない Nginx（uid 101）。ダイジェストで固定する（新しいイメージが出ると Dependabot が更新の PR を出す）
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS runtime
# Alpine のセキュリティ更新を入れる（ベースイメージの更新を待たずに、修正済みの脆弱性を直す）。
# publish.yml はこのステージをキャッシュを使わずに作るので、作り直すたびに最新の更新が入る
USER root
RUN apk upgrade --no-cache
# 非 root の Nginx（uid 101）に戻す
USER 101
# 待ち受けるポート。Render は PORT を環境変数で渡す。起動時に templates/ の ${PORT} が置き換わる
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=web-builder /app/csp.conf /etc/nginx/csp.conf
COPY --from=web-builder /app/frontend/out /usr/share/nginx/html
EXPOSE 8080
