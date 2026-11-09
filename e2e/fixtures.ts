import { test as base, expect } from "@playwright/test";

/**
 * ブラウザが出す、実害のないエラー。ページを移動・再読み込みするときに、Next.js のリンクの先読み（RSC のデータ）が
 * 中断されると、WebKit は「access control checks」、Next.js は「Failed to fetch RSC payload」として出す
 */
const IGNORED_ERRORS = [
  // 移動・再読み込みの途中で、同じサーバーへの取得（Next.js の先読み・ページ・Web Worker のスクリプト）が中断されたとき（WebKit）。
  // 外部への通信は CSP の違反として別の文言で出るので、ここでは無視しない
  /localhost(:\d+)?\/\S* due to access control checks/,
  /Failed to fetch RSC payload/,
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
      // WebKit は、移動の途中で Web Worker のスクリプトの読み込みを中断したことを、ページの例外としても出す
      page.on("pageerror", (err) => {
        if (!IGNORED_ERRORS.some((re) => re.test(err.message))) errors.push(err.message);
      });
      await use(errors);
      expect(errors, "コンソールのエラー").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
