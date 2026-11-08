import { test as base, expect } from "@playwright/test";

/**
 * すべての画面のテストで、コンソールのエラー（CSP の違反など）とページの例外がないことを確かめる
 */
export const test = base.extend<{ consoleErrors: string[] }>({
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
