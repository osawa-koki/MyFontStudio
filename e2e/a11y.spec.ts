import AxeBuilder from "@axe-core/playwright";
import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

// 各ページのアクセシビリティを axe で確かめる（axe はブラウザの中だけで動き、外部に送信しない）。
// ブラウザによらないので Chromium だけで流す
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "chromium", "ブラウザによらない");
});

async function expectNoViolations(page: import("@playwright/test").Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.map(
      (v) => `${v.id}（${v.impact}）：${v.nodes.map((n) => n.target.join(" ")).join("、")}`,
    ),
  ).toEqual([]);
}

test("使い方ページ", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "手書きフォントを作ろう" })).toBeVisible();
  await expectNoViolations(page);
});

test("入力ページ（文字一覧・Canvas・ペン設定）とプレビュー", async ({ page }) => {
  await page.goto("./editor");
  await page.getByLabel("追加する文字列").fill("あい");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByTestId("current-char")).toHaveText("い");
  await expectNoViolations(page);

  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await expect(page.getByTestId("preview-area")).toBeVisible();
  await expectNoViolations(page);
});
