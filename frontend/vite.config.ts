import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 配信するパス。GitHub Pages では /MyFontStudio/（pages.yml で BASE_PATH を渡す）、Docker（Nginx）ではルート
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // カバレッジは純粋な関数（lib・store）だけを数える。画面（pages・components）は E2E とブラウザでの確認に任せる
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/store/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
});
