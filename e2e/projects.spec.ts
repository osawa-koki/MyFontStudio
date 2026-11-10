import type { Page } from "@playwright/test";
import { drawStroke } from "./drawing";
import { waitForStored } from "./storage";
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
  await page.goto("./editor");
  await expect(page).toHaveURL(UUID_URL);
  const id = uuidOf(page);
  await addAndDraw(page, "大澤");
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  // 保存されて一覧に 1 文字と出るまで待つ
  await waitForStored(
    page,
    "myfontstudio:projects",
    (list) =>
      Array.isArray(list) &&
      list.some((p: { id: string; glyphCount: number }) => p.id === id && p.glyphCount === 1),
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`uuid=${id}$`));
  await expect(page.getByLabel("登録済み文字数")).toHaveText("1 文字");
  await expect(page.getByText("zip 未保存", { exact: true })).toBeVisible();
  await expect(page.getByTestId("current-char")).toHaveText("澤");
  // プレビューへのリンクにも uuid が付く
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/preview/\\?uuid=${id}$`));
});

test("複数のプロジェクトを持ち、一覧から開いたり削除したりできる", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("First");
  await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(UUID_URL);
  const first = uuidOf(page);
  await addAndDraw(page, "一");

  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "使い方" })
    .click();
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("Second");
  await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
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
  await expect(page.getByRole("button", { name: /フォント名：First/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(1);

  // URL を直接開いても、そのプロジェクトになる
  await page.goto(`./editor/?uuid=${second}`);
  await expect(page.getByRole("button", { name: /フォント名：Second/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(2);

  await page.goto("./");
  await page.getByRole("button", { name: "Second を削除" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "削除" }).click();
  await expect(page.getByRole("link", { name: /を開く$/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "First を開く" })).toBeVisible();
});

test("このブラウザに保存されていない uuid を開くと、新しいプロジェクトとして始めることを知らせる", async ({
  page,
}) => {
  await page.goto("./editor/?uuid=0b8e6c4e-2f1a-4c3b-9d5e-7a6b5c4d3e2f");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "このブラウザに保存されていないので、新しいプロジェクトとして始めます" }),
  ).toBeVisible();
  await expect(page.getByLabel("登録済み文字数")).toHaveText("0 文字");
});

test("uuid の形が正しくなければ案内する", async ({ page }) => {
  await page.goto("./editor/?uuid=../../etc");
  await expect(page.getByRole("heading", { name: "プロジェクトを開けません" })).toBeVisible();
  await page.getByRole("link", { name: "プロジェクトの一覧へ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("手書きフォントを作ろう");
});

test("ヘッダーのメニューから、新しいプロジェクトの作成・切り替え・ZIP の読み込みができる", async ({
  page,
}) => {
  await page.goto("./");
  const switcher = page.getByRole("button", { name: /^プロジェクト：/ });
  await expect(switcher).toHaveAccessibleName("プロジェクト：未選択（クリックで切り替え）");

  // 新しいプロジェクト（1 つ目）
  await switcher.click();
  await expect(page.getByRole("menu", { name: "プロジェクト" })).toContainText(
    "まだプロジェクトがありません",
  );
  await page.getByRole("menuitem", { name: "新しいプロジェクト", exact: true }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("Alpha");
  await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(UUID_URL);
  const alpha = uuidOf(page);
  await addAndDraw(page, "甲");

  // 新しいプロジェクト（2 つ目）
  await switcher.click();
  await page.getByRole("menuitem", { name: "新しいプロジェクト", exact: true }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("Beta");
  await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Beta/);
  await addAndDraw(page, "乙丙");

  // 描きかけの線は描いた履歴として残るので、切り替えても消えない（確認も出ない）
  await drawStroke(page, [
    [300, 300],
    [700, 700],
  ]);
  const canvas = page.getByTestId("drawing-canvas");
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 1 本/);
  await switcher.click();
  const menu = page.getByRole("menu", { name: "プロジェクト" });
  await expect(menu.getByRole("menuitemradio")).toHaveCount(2);
  await expect(menu.getByRole("menuitemradio", { name: /Beta/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await menu.getByRole("menuitemradio", { name: /Alpha/ }).click();
  await expect(page).toHaveURL(new RegExp(`uuid=${alpha}$`));
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Alpha/);
  await expect(page.getByRole("region", { name: "文字一覧" }).getByRole("listitem")).toHaveCount(1);
  await switcher.click();
  await menu.getByRole("menuitemradio", { name: /Beta/ }).click();
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Beta/);
  await expect(canvas).toHaveAttribute("aria-label", /「丙」の手書き入力欄（ストローク 1 本）/);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 0 本/);
  await switcher.click();
  await menu.getByRole("menuitemradio", { name: /Alpha/ }).click();
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Alpha/);

  // プレビューで切り替えると、プレビューのまま
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await switcher.click();
  await menu.getByRole("menuitemradio", { name: /Beta/ }).click();
  await expect(page).toHaveURL(/\/preview\/\?uuid=[0-9a-f-]{36}$/);
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Beta/);

  // Esc でメニューを閉じる
  await switcher.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // ZIP を読み込む：Beta を zip に保存して、新しいプロジェクトとして読み込む
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "zip で保存" }).click();
  const zipPath = await (await downloading).path();
  await switcher.click();
  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: /ZIP を読み込む/ }).click();
  await (await choosing).setFiles(zipPath);
  await expect(page).toHaveURL(UUID_URL);
  await switcher.click();
  await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
});

test("プロジェクトの切り替えメニューとダウンロードのメニューを、キーボードだけで操作できる", async ({
  page,
}) => {
  for (const name of ["Alpha", "Beta"]) {
    await page.goto("./");
    await page.getByRole("button", { name: "新しくはじめる" }).click();
    await page.getByRole("dialog").getByLabel("フォント名").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
    await expect(page).toHaveURL(UUID_URL);
  }
  await addAndDraw(page, "乙");
  const switcher = page.getByRole("button", { name: /^プロジェクト：/ });
  const menu = page.getByRole("menu", { name: "プロジェクト" });

  // Enter で開くと最初の項目（Beta）にフォーカス。↓ で Alpha、Enter で切り替え
  await switcher.focus();
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitemradio", { name: /Beta/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: /Alpha/ })).toBeFocused();
  // End で最後の項目、Home で最初の項目、↑ で端から折り返す
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: /ZIP を読み込む/ })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.getByRole("menuitemradio", { name: /Beta/ })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitem", { name: /ZIP を読み込む/ })).toBeFocused();
  // Esc で閉じてボタンに戻る
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(switcher).toBeFocused();
  // ↓ で開いて（一覧を読み込んで最初の項目にフォーカスが移ってから）Alpha を選ぶ
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: /Beta/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(switcher).toHaveAccessibleName(/プロジェクト：Alpha/);

  // ダウンロードのメニュー：↑ で開くと最後の項目（.otf）
  await switcher.click();
  await menu.getByRole("menuitemradio", { name: /Beta/ }).click();
  const formatButton = page.getByRole("button", {
    name: "形式を選んでダウンロード",
  });
  await expect(formatButton).toBeEnabled();
  await formatButton.focus();
  await page.keyboard.press("ArrowUp");
  await expect(
    page
      .getByRole("menu", { name: "ダウンロードする形式" })
      .getByRole("menuitem", { name: ".otf" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(formatButton).toBeFocused();
  const downloading = page.waitForEvent("download");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  expect((await downloading).suggestedFilename()).toBe("Beta.ttf");
});

test("同じプロジェクトを 2 つのタブで開くと、編集できるのは 1 つだけで、引き継ぐと最新の内容を読み直す", async ({
  page,
  context,
}) => {
  await page.goto("./editor");
  await expect(page).toHaveURL(UUID_URL);
  const url = page.url();
  await addAndDraw(page, "甲乙");

  // 2 つ目のタブで同じプロジェクトを開くと、編集できない
  const second = await context.newPage();
  await second.goto(url);
  await expect(
    second.getByRole("heading", {
      name: "このプロジェクトはほかのタブで開いています",
    }),
  ).toBeVisible();
  await expect(second.getByTestId("drawing-canvas")).toHaveCount(0);

  // 引き継ぐと、1 つ目のタブは編集を止め、2 つ目のタブは 1 つ目で保存した内容を読み直す
  await second.getByRole("button", { name: "このタブで編集する" }).click();
  await expect(second.getByLabel("登録済み文字数")).toHaveText("1 文字");
  await expect(second.getByTestId("current-char")).toHaveText("乙");
  await expect(
    page.getByRole("heading", {
      name: "ほかのタブでこのプロジェクトを開いたので、このタブでは編集を止めました",
    }),
  ).toBeVisible();

  // 2 つ目のタブで描いて保存し、1 つ目のタブで引き継ぎ直すと、その内容が見える
  await addAndDraw(second, "丙");
  await page.getByRole("button", { name: "このタブで編集する" }).click();
  await expect(page.getByLabel("登録済み文字数")).toHaveText("2 文字");
  await expect(
    second.getByRole("heading", {
      name: "ほかのタブでこのプロジェクトを開いたので、このタブでは編集を止めました",
    }),
  ).toBeVisible();
  await second.close();
});

test("ほかのタブで開いているプロジェクトは削除できず、そのタブを閉じれば削除できる", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "新しくはじめる" }).click();
  await page.getByRole("dialog").getByLabel("フォント名").fill("Shared");
  await page.getByRole("dialog").getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(UUID_URL);
  await addAndDraw(page, "共");

  // 2 つ目のタブの使い方ページから削除しようとしても、1 つ目のタブで開いているので削除しない
  const second = await context.newPage();
  await second.goto("./");
  await second.getByRole("button", { name: "Shared を削除" }).click();
  await second.getByRole("dialog").getByRole("button", { name: "削除" }).click();
  await expect(second.getByText(/ほかのタブで開いているので、削除できません/)).toBeVisible();
  await expect(second.getByRole("link", { name: "Shared を開く" })).toBeVisible();

  // 1 つ目のタブを閉じれば削除できる
  await page.close();
  await second.getByRole("button", { name: "Shared を削除" }).click();
  await second.getByRole("dialog").getByRole("button", { name: "削除" }).click();
  await expect(second.getByText("プロジェクトを削除しました")).toBeVisible();
  await expect(second.getByRole("link", { name: "Shared を開く" })).toHaveCount(0);
});

test("使い方ページに移ってもロックを持ち続け、あとから開いたタブではヘッダーの操作もできない", async ({
  page,
  context,
}) => {
  await page.goto("./editor");
  await expect(page).toHaveURL(UUID_URL);
  const url = page.url();
  await addAndDraw(page, "甲");
  // 1 つ目のタブは使い方ページに移る（プロジェクトは開いたまま）
  await page.getByRole("link", { name: "使い方" }).click();
  await expect(page.getByRole("heading", { name: "手書きフォントを作ろう" })).toBeVisible();

  const second = await context.newPage();
  await second.goto(url);
  await expect(
    second.getByRole("heading", { name: "このプロジェクトはほかのタブで開いています" }),
  ).toBeVisible();
  // 古い内容で上書き・書き出しをしないよう、ヘッダーの操作は使えない
  await expect(second.getByRole("button", { name: /^フォント名：/ })).toBeDisabled();
  await expect(second.getByRole("button", { name: "zip で保存" })).toBeDisabled();
  await expect(
    second.getByRole("button", { name: "フォントをダウンロード（.ttf）" }),
  ).toBeDisabled();

  // 1 つ目のタブでは、使い方ページからもヘッダーで編集できる
  await page.getByRole("button", { name: /^フォント名：/ }).click();
  await expect(page.getByRole("dialog", { name: "フォントの設定" })).toBeVisible();
  await second.close();
});
