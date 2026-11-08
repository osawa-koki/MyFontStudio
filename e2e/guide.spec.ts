import { drawStroke } from "./drawing";
import { currentUuid, waitForStored } from "./storage";
import { expect, test } from "./fixtures";

test("使い方ページから、フォント名を決めて新しいプロジェクトを作れる", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "5. フォントのインストール方法" })).toBeVisible();
  await expect(page.getByText("まだありません。")).toBeVisible();
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  const dialog = page.getByRole("dialog", {
    name: "フォント名を決めてください",
  });
  await dialog.getByLabel("フォント名").fill("Osawa Hand!");
  await dialog.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/editor\/\?uuid=[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: /フォント名：OsawaHand/ })).toBeVisible();

  // 空のプロジェクトでも、作ったものは一覧に出る
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "使い方" })
    .click();
  await expect(page.getByRole("link", { name: "OsawaHand を開く" })).toBeVisible();
});

test("描いた線は描いた履歴として残り、再読み込みしても元に戻す・やり直しができる", async ({
  page,
  beforeUnloadCount,
}) => {
  await page.goto("./editor");
  // URL に uuid が付く（画面の中での移動）のを待ってから再読み込みする
  await expect(page).toHaveURL(/uuid=/);
  // 変更がなければ警告しない
  await page.reload();
  expect(beforeUnloadCount.value).toBe(0);

  await page.getByLabel("追加する文字列").fill("あい");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  await drawStroke(page, [
    [200, 500],
    [800, 500],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  // 「い」に描きかけを 2 本
  for (const y of [300, 700]) {
    await drawStroke(page, [
      [200, y],
      [800, y],
    ]);
  }
  // 描いた線はすぐに保存する（「い」の履歴が 2 本になったのを確かめてから再読み込みする）
  await waitForStored(
    page,
    `myfontstudio:project:${currentUuid(page)}:drawing:U+3044`,
    (h) => (h as { ops?: unknown[] } | undefined)?.ops?.length === 2,
  );
  await page.reload();

  const canvas = page.getByTestId("drawing-canvas");
  await expect(page.getByTestId("current-char")).toHaveText("い");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
  await expect(page.getByText("未保存のストロークがあります")).toBeVisible();
  await page.getByTestId("drawing-canvas").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 1 本/);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);

  // 保存したあとも、その文字の履歴で元に戻せる
  await page
    .getByRole("region", { name: "文字一覧" })
    .getByRole("button", { name: /^あ（/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "そのまま移動" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /「あ」.*ストローク 1 本/);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 0 本/);
  // 「い」の描きかけはそのまま
  await page.keyboard.press("ArrowRight");
  // 「あ」は元に戻して保存済みと違うので確かめられる。描きかけのまま移る
  await page.getByRole("dialog").getByRole("button", { name: "そのまま移動" }).click();
  await expect(page.getByTestId("current-char")).toHaveText("い");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
});

test("このブラウザへの保存の状態（永続化・使用量）を表示し、永続化を頼める", async ({ page }) => {
  await page.goto("./");
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
      page.getByRole("status").filter({ hasText: /設定しました|許可されませんでした/ }),
    ).toBeVisible();
  } else {
    await expect(status).toContainText("自動では消されません");
  }
});
