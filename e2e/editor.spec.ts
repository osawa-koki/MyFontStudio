import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

const chip = (page: import("@playwright/test").Page, c: string) =>
  page
    .getByRole("region", { name: "文字一覧" })
    .getByRole("button", { name: new RegExp(`^${c}（`) });

test("「大澤太郎」を入力すると 4 文字が並び、描いて保存するたびに次の文字へ進む", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("大澤太郎");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  const list = page.getByRole("region", { name: "文字一覧" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("current-char")).toHaveText("大");

  for (const [i, next] of [
    [1, "澤"],
    [2, "太"],
    [3, "郎"],
  ] as const) {
    await drawStroke(page, [
      [200, 500],
      [800, 500],
    ]);
    // 保存は Enter（テキスト入力の外）でもボタンでもよい
    if (i % 2 === 1)
      await page.getByRole("button", { name: "保存", exact: true }).click();
    else {
      await page.getByTestId("drawing-canvas").focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByTestId("current-char")).toHaveText(next);
    await expect(page.getByLabel("登録済み文字数")).toHaveText(`${i} 文字`);
  }
  await drawStroke(page, [
    [500, 200],
    [500, 800],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("すべての文字を作成しました")).toBeVisible();
  await expect(chip(page, "郎")).toHaveAccessibleName(/作成済み/);
  // フォントができるとダウンロードできる
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "フォントをダウンロード（.ttf）" })
    .click();
  expect((await download).suggestedFilename()).toBe("MyHandwriting.ttf");
});

test("未保存のストロークがあるときに移動すると確かめる。対応していない文字は通知する", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("あい😀");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "対応していない文字" }),
  ).toBeVisible();
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await chip(page, "い").click();
  const dialog = page.getByRole("dialog", {
    name: "「あ」は保存されていません",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByTestId("current-char")).toHaveText("あ");
  await chip(page, "い").click();
  await dialog.getByRole("button", { name: "保存して移動" }).click();
  await expect(page.getByTestId("current-char")).toHaveText("い");
  await expect(chip(page, "あ")).toHaveAccessibleName(/作成済み/);

  // 右クリックで削除（作成済みは確認）
  await chip(page, "あ").click({ button: "right" });
  await page.getByRole("dialog").getByRole("button", { name: "削除" }).click();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("文字列入力欄は複数行で入力でき、Enter は改行、Ctrl/Cmd+Enter と「追加」で追加する", async ({ page }) => {
  await page.goto("/editor");
  const input = page.getByLabel("追加する文字列");
  await input.fill("大澤");
  await input.press("Enter");
  await input.pressSequentially("太郎");
  await expect(input).toHaveValue("大澤\n太郎");
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(0);
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(4);
  await expect(input).toHaveValue("");
  await input.fill("東京\n都");
  await input.press("ControlOrMeta+Enter");
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(7);
});

test("プリセットで文字群を追加でき、← → で移動できる", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("button", { name: "数字" }).click();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(10);
  await expect(page.getByTestId("current-char")).toHaveText("0");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("current-char")).toHaveText("1");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("current-char")).toHaveText("0");
});
