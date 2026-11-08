import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

test("リロードしても、自動保存から作業を復元できる", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("大澤");
  await page.getByLabel("追加する文字列").press("Enter");
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  // 自動保存（500ms 待つ）を待ってからリロードする
  await page.waitForTimeout(1000);
  await page.reload();

  const dialog = page.getByRole("dialog", { name: "前回の作業を復元しますか？" });
  await expect(dialog).toContainText("MyHandwriting");
  await dialog.getByRole("button", { name: "復元する" }).click();
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  await expect(page.getByText("未保存", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByTestId("current-char")).toHaveText("澤");

  // 復元しないを選ぶと、自動保存したデータは消える
  await page.reload();
  await page.getByRole("dialog", { name: "前回の作業を復元しますか？" }).getByRole("button", { name: "復元しない" }).click();
  await expect(page.getByLabel("登録済み文字数")).toHaveText("0 文字");
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
