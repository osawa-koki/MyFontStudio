import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

test("使い方ページから入力ページ・プレビューに移動できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "ページ" }).getByRole("link", { name: "入力" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await page.getByRole("navigation", { name: "ページ" }).getByRole("link", { name: "プレビュー" }).click();
  await expect(page).toHaveURL(/\/preview$/);
});

test("Canvas にマウスで描き、元に戻す・やり直し・クリアができる", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("あ");
  await page.getByLabel("追加する文字列").press("Enter");
  const canvas = page.getByTestId("drawing-canvas");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 0 本/);
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await drawStroke(page, [
    [500, 200],
    [500, 800],
  ]);
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 1 本/);
  await page.getByRole("button", { name: "やり直し" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
  await page.getByRole("button", { name: "クリア" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 0 本/);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
});
