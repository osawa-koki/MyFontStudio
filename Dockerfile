# ---- 画面（Vite）のビルド ----
FROM node:26-alpine AS web-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Nginx で index.html にフォールバックするので BrowserRouter（/editor）でビルドする
ENV VITE_ROUTER=browser \
    BASE_PATH=/
RUN npm run build

# ---- 実行（Nginx で静的ファイルを配信） ----
# root でない Nginx（uid 101）。ダイジェストで固定する（新しいイメージが出ると Dependabot が更新の PR を出す）
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS runtime
# 待ち受けるポート。Render は PORT を環境変数で渡す。起動時に templates/ の ${PORT} が置き換わる
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=web-builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
