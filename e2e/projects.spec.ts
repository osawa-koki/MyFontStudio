import type { Page } from "@playwright/test";
import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

const UUID_URL = /\/editor\/\?uuid=([0-9a-f-]{36})$/;

async function addAndDraw(page: Page, chars: string) {
  await page.getByLabel("追加する文字列").fill(chars);
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
}

const uuidOf = (page: Page) => UUID_URL.exec(page.url())![1]!;

test("uuid のない URL を開くと新しいプロジェクトの uuid が付き、リロードしても自動で開き直す", async ({
  page,
}) => {
  await page.goto("/editor");
  await expect(page).toHaveURL(UUID_URL);
  const id = uuidOf(page);
  await addAndDraw(page, "大澤");
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  await page.waitForTimeout(800); // 自動保存（500ms）を待つ
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`uuid=${id}$`));
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  await expect(page.getByText("未保存", { exact: true })).toBeVisible();
  await expect(page.getByTestId("current-char")).toHaveText("澤");
  // プレビューへのリンクにも uuid が付く
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/preview/\\?uuid=${id}$`));
});

test("複数のプロジェクトを持ち、一覧から開いたり削除したりできる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("First");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "はじめる" })
    .click();
  await expect(page).toHaveURL(UUID_URL);
  const first = uuidOf(page);
  await addAndDraw(page, "一");

  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "使い方" })
    .click();
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("Second");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "はじめる" })
    .click();
  await expect(page).toHaveURL(UUID_URL);
  const second = uuidOf(page);
  expect(second).not.toBe(first);
  await addAndDraw(page, "二三");

  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "使い方" })
    .click();
  await expect(page.getByRole("link", { name: /を開く$/ })).toHaveCount(2);
  await page.getByRole("link", { name: "First を開く" }).click();
  await expect(page).toHaveURL(new RegExp(`uuid=${first}$`));
  await expect(
    page.getByRole("button", { name: /フォント名：First/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(1);

  // URL を直接開いても、そのプロジェクトになる
  await page.goto(`/editor/?uuid=${second}`);
  await expect(
    page.getByRole("button", { name: /フォント名：Second/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(2);

  await page.goto("/");
  await page.getByRole("button", { name: "Second を削除" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "削除" }).click();
  await expect(page.getByRole("link", { name: /を開く$/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "First を開く" })).toBeVisible();
});

test("uuid の形が正しくなければ案内する", async ({ page }) => {
  await page.goto("/editor/?uuid=../../etc");
  await expect(
    page.getByRole("heading", { name: "プロジェクトを開けません" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "プロジェクトの一覧へ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "手書きフォントを作ろう",
  );
});
