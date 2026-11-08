import { defineConfig } from "vitest/config";

// 単体テスト（Vitest）。画面のビルドは Next.js（next.config.ts）
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // カバレッジは純粋な関数（lib・store・Worker の処理の本体）だけを数える。画面（app・views・components・features）は E2E で確かめる
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/store/**/*.ts", "src/workers/tasks.ts"],
      // png.ts は Canvas（OffscreenCanvas）で描くので、ブラウザ（E2E）で確かめる
      exclude: ["src/**/*.test.ts", "src/lib/glyph/png.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
});
