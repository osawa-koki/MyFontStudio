import type { Page } from "@playwright/test";
import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

/** 入力ページで文字を追加し、それぞれ 1 本ずつ描いて保存する */
async function createChars(page: Page, chars: string) {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill(chars);
  await page.getByLabel("追加する文字列").press("Enter");
  for (let i = 0; i < Array.from(chars).length; i++) {
    await drawStroke(page, [
      [200, 300 + i * 50],
      [800, 700 - i * 50],
    ]);
    await page.getByRole("button", { name: "保存", exact: true }).click();
  }
}

test("グリフがないときは入力ページへ案内する", async ({ page }) => {
  await page.goto("/preview");
  await expect(
    page.getByText("まだ文字がありません。入力ページで文字を作成してください"),
  ).toBeVisible();
  await page.getByRole("link", { name: "入力ページへ" }).click();
  await expect(page).toHaveURL(/\/editor$/);
});

test("保存した文字が手書きのフォントで表示され、未作成の文字を表示・追加できる", async ({
  page,
}) => {
  await createChars(page, "大澤");
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  const textarea = page.getByLabel("確かめたい文章");
  // 初期値は作成済みの文字を連結したもの
  await expect(textarea).toHaveValue("大澤");
  const area = page.getByTestId("preview-area");
  await expect(area).toHaveCSS("font-family", /hw-preview-\d+/);
  // FontFace が読み込まれている
  const family = (await area.evaluate((el) => getComputedStyle(el).fontFamily))
    .split(",")[0]!
    .replaceAll('"', "");
  expect(
    await page.evaluate(
      (f) => document.fonts.check(`24px "${f}"`, "大"),
      family,
    ),
  ).toBe(true);

  await textarea.fill("大澤太郎\n大 澤");
  await expect(area.locator("[data-missing]")).toHaveText("太郎");
  const missing = page.getByRole("region", { name: "未作成の文字" });
  await expect(missing).toContainText("2 文字");

  await page.getByLabel("未作成文字の表示").selectOption("notdef");
  await expect(area.getByRole("img", { name: /未作成の文字/ })).toHaveCount(2);
  await page.getByLabel("未作成文字の表示").selectOption("fallback");
  await expect(area.locator("[data-missing]")).toHaveCount(0);

  // 文章は画面を移動しても消えない
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "入力" })
    .click();
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await expect(textarea).toHaveValue("大澤太郎\n大 澤");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: ".otf をダウンロード" }).click();
  expect((await download).suggestedFilename()).toBe("MyHandwriting.otf");

  await missing
    .getByRole("button", { name: "入力ページに追加して描く" })
    .click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("current-char")).toHaveText("太");
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(4);
});
