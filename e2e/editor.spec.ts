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

test("文字列入力欄は複数行で入力でき、Enter は改行、Ctrl/Cmd+Enter と「追加」で追加する", async ({
  page,
}) => {
  await page.goto("/editor");
  const input = page.getByLabel("追加する文字列");
  await input.fill("大澤");
  await input.press("Enter");
  await input.pressSequentially("太郎");
  await expect(input).toHaveValue("大澤\n太郎");
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(input).toHaveValue("");
  await input.fill("東京\n都");
  await input.press("ControlOrMeta+Enter");
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(7);
});

test("プリセットは、まだ一覧にない文字の数を示して確かめてから追加する", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("0１2");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  const list = page
    .getByRole("region", { name: "文字一覧" })
    .getByRole("listitem");
  await expect(list).toHaveCount(3);
  await page.getByRole("button", { name: "数字" }).click();
  const dialog = page.getByRole("dialog", {
    name: "数字を 8 文字追加しますか？",
  });
  await expect(dialog).toContainText(
    "10 文字のうち、2 文字はすでに一覧にあります",
  );
  // キャンセルすると追加しない
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(list).toHaveCount(3);
  await page.getByRole("button", { name: "数字" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "追加する" })
    .click();
  await expect(list).toHaveCount(11);
  // すべて一覧にあれば、確かめずに知らせる
  await page.getByRole("button", { name: "数字" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "数字の 10 文字は、すべて一覧にあります" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("プリセットで文字群を追加でき、← → で移動できる", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("button", { name: "数字" }).click();
  const dialog = page.getByRole("dialog", {
    name: "数字を 10 文字追加しますか？",
  });
  await expect(dialog).toContainText("0 1 2 3 4 5 6 7 8 9");
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(10);
  await expect(page.getByTestId("current-char")).toHaveText("0");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("current-char")).toHaveText("1");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("current-char")).toHaveText("0");
});

test("文字一覧を並び替え・検索・絞り込みできる", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("澤あAア1大");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  const region = page.getByRole("region", { name: "文字一覧" });
  const chars = async () =>
    (await region.getByRole("listitem").allTextContents()).map((t) =>
      t.trim().charAt(0),
    );
  expect(await chars()).toEqual(["澤", "あ", "A", "ア", "1", "大"]);

  // 「あ」「大」を作成する（大 → あ の順に保存）
  for (const c of ["大", "あ"]) {
    await region.getByRole("button", { name: new RegExp(`^${c}（`) }).click();
    await drawStroke(page, [
      [200, 500],
      [800, 500],
    ]);
    await page.getByRole("button", { name: "保存", exact: true }).click();
  }

  await page.getByLabel("並び順").selectOption("codepoint");
  expect(await chars()).toEqual(["1", "A", "あ", "ア", "大", "澤"]);
  await page.getByRole("button", { name: /昇順（クリックで降順）/ }).click();
  expect(await chars()).toEqual(["澤", "大", "ア", "あ", "A", "1"]);
  await page.getByLabel("並び順").selectOption("updated");
  // 降順：新しく保存したもの（あ）が先頭。未作成は最後
  expect(await chars()).toEqual(["あ", "大", "澤", "A", "ア", "1"]);

  await page.getByLabel("作成状況").selectOption("uncreated");
  expect(await chars()).toEqual(["澤", "A", "ア", "1"]);
  await expect(region).toContainText("表示 4 文字");
  await page.getByLabel("文字の種類").selectOption("latin");
  expect(await chars()).toEqual(["A"]);
  await page.getByLabel("文字の種類").selectOption("all");
  await page.getByLabel("作成状況").selectOption("all");

  await page.getByLabel("文字一覧を検索").fill("大澤太郎");
  expect(await chars()).toEqual(["大", "澤"]);
  await page.getByLabel("文字一覧を検索").fill("U+30");
  expect(await chars()).toEqual(["あ", "ア"]);
  await page.getByLabel("文字一覧を検索").fill("x");
  await expect(region).toContainText("条件に合う文字がありません");
  await region.getByRole("button", { name: "絞り込みを解除" }).click();
  await expect(region.getByRole("listitem")).toHaveCount(6);
  await expect(page.getByLabel("文字一覧を検索")).toHaveValue("");
});

test("ペンを検出すると指の入力を無視する。自分で OFF にしたら、ペンで描いても ON に戻らない", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("あ");
  await page.getByLabel("追加する文字列").press("ControlOrMeta+Enter");
  const canvas = page.getByTestId("drawing-canvas");
  const box = (await canvas.boundingBox())!;
  const pen = async (y: number) => {
    const at = (x: number) => ({
      pointerType: "pen",
      pointerId: 7,
      isPrimary: true,
      pressure: 0.6,
      button: 0,
      buttons: 1,
      clientX: box.x + box.width * x,
      clientY: box.y + box.height * y,
      bubbles: true,
    });
    await canvas.dispatchEvent("pointerdown", at(0.2));
    await canvas.dispatchEvent("pointermove", at(0.5));
    await canvas.dispatchEvent("pointermove", at(0.8));
    await canvas.dispatchEvent("pointerup", at(0.8));
  };
  const ignoreTouch = page.getByLabel("指の入力を無視");
  await expect(ignoreTouch).not.toBeChecked();
  await pen(0.3);
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 1 本/);
  await expect(ignoreTouch).toBeChecked();
  await expect(page.getByRole("status").filter({ hasText: "ペンを検出したので" })).toBeVisible();

  await ignoreTouch.uncheck();
  await pen(0.6);
  await expect(canvas).toHaveAttribute("aria-label", /ストローク 2 本/);
  await expect(ignoreTouch).not.toBeChecked();
  // 選んだ値はブラウザに覚えておく
  await page.reload();
  await expect(page.getByLabel("指の入力を無視")).not.toBeChecked();
});
