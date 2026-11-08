import { defineConfig, devices } from "@playwright/test";

// 動いているサーバーに対して実行する。BASE_URL で先を変える（末尾の / はあってもなくてもよい。テストは相対パスで開く）。
// PAGES=1 のときは GitHub Pages 用のビルド（/MyFontStudio で配信。HTTP ヘッダーなし）に対して、Nginx のテストを除いて流す
const pages = !!process.env.PAGES;
const baseURL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/?$/, "/");
// Nginx の応答・ヘッダーのテストは Chromium だけで流す（ブラウザによらない）
const nginxOnly = /server\.spec\.ts/;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  testIgnore: pages ? nginxOnly : undefined,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ja-JP",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: nginxOnly },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: nginxOnly },
    // iPad（Safari）。タッチの端末として開く
    { name: "ipad", use: { ...devices["iPad Pro 11"] }, testIgnore: nginxOnly },
  ],
});
