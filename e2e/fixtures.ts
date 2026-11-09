import { test as base, expect } from "@playwright/test";

/**
 * ブラウザが出す、実害のないエラー。ページを移動・再読み込みするときに、Next.js のリンクの先読み（RSC のデータ）が
 * 中断されると、WebKit は「access control checks」、Next.js は「Failed to fetch RSC payload」として出す
 */
const IGNORED_ERRORS = [
  /_rsc=.*access control checks/,
  /Failed to fetch RSC payload/,
  // 再読み込みの途中で Web Worker の読み込みが中断されたとき（WebKit）
  /workers\/font\.worker\.js due to access control checks/,
];

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
        if (msg.type() === "error" && !IGNORED_ERRORS.some((re) => re.test(msg.text()))) {
          errors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "コンソールのエラー").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
