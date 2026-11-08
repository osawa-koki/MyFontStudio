import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

test("使い方ページから、フォント名を決めて新しいプロジェクトを作れる", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "5. フォントのインストール方法" }),
  ).toBeVisible();
  await expect(page.getByText("まだありません。")).toBeVisible();
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  const dialog = page.getByRole("dialog", {
    name: "フォント名を決めてください",
  });
  await dialog.getByLabel("フォント名").fill("Osawa Hand!");
  await dialog.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/editor\/\?uuid=[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("button", { name: /フォント名：OsawaHand/ }),
  ).toBeVisible();

  // 空のプロジェクトでも、作ったものは一覧に出る
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "使い方" })
    .click();
  await expect(
    page.getByRole("link", { name: "OsawaHand を開く" }),
  ).toBeVisible();
});

test("保存していない描きかけのストロークがあると、タブを閉じる・再読み込みする前に警告する", async ({
  page,
  beforeUnloadCount,
}) => {
  await page.goto("/editor");
  // 変更がなければ警告しない
  await page.reload();
  expect(beforeUnloadCount.value).toBe(0);

  await page.getByLabel("追加する文字列").fill("あ");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  // 文字の追加は自動で保存されるので警告しない
  await page.waitForTimeout(800);
  await page.reload();
  expect(beforeUnloadCount.value).toBe(0);
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await page.reload();
  expect(beforeUnloadCount.value).toBe(1);
});

test("このブラウザへの保存の状態（永続化・使用量）を表示し、永続化を頼める", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.getByTestId("storage-status");
  await expect(status).toContainText("使用量");
  await expect(status).toContainText("zip でも保存してください");
  const button = status.getByRole("button", {
    name: "データを消されないようにする",
  });
  // ブラウザが永続化を許すかは環境による。許されていなければボタンを押して結果を知らせる
  if (await button.isVisible()) {
    await button.click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /設定しました|許可されませんでした/ }),
    ).toBeVisible();
  } else {
    await expect(status).toContainText("自動では消されません");
  }
});
