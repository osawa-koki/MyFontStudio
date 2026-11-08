import { defineConfig } from "vitest/config";

// 単体テスト（Vitest）。画面のビルドは Next.js（next.config.ts）
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // カバレッジは純粋な関数（lib・store）だけを数える。画面（app・views・components・features）は E2E で確かめる
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/store/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
});
