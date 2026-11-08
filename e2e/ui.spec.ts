import { expect, test } from "./fixtures";

test("使い方ページから入力ページ・プレビューに移動できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "ページ" }).getByRole("link", { name: "入力" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await page.getByRole("navigation", { name: "ページ" }).getByRole("link", { name: "プレビュー" }).click();
  await expect(page).toHaveURL(/\/preview$/);
});
