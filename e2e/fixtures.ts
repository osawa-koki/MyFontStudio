import { test as base, expect } from "@playwright/test";

/**
 * すべての画面のテストで、コンソールのエラー（CSP の違反など）とページの例外がないことを確かめる。
 * 未保存の警告（beforeunload）のダイアログは受け入れて（リロード・移動を続けて）、beforeUnloadCount に数える
 */
export const test = base.extend<{
  consoleErrors: string[];
  beforeUnloadCount: { value: number };
}>({
  beforeUnloadCount: [
    async ({ page }, use) => {
      const count = { value: 0 };
      page.on("dialog", (dialog) => {
        if (dialog.type() === "beforeunload") {
          count.value++;
          void dialog.accept();
        }
      });
      await use(count);
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "コンソールのエラー").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
