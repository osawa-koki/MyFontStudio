import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { drawStroke } from "./drawing";
import { expect, test } from "./fixtures";

test("zip で保存 → リロード → zip を開くで、一覧・ストローク・設定・文章が復元される", async ({
  page,
}) => {
  await page.goto("/editor");
  await page.getByLabel("追加する文字列").fill("口十未");
  await page.getByLabel("追加する文字列").press("Enter");
  await drawStroke(page, [
    [250, 250],
    [750, 250],
    [750, 750],
    [250, 750],
    [250, 250],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await drawStroke(page, [
    [150, 450],
    [850, 450],
  ]);
  await drawStroke(page, [
    [500, 100],
    [500, 850],
  ]);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await page.getByLabel("確かめたい文章").fill("口十未作成");
  await expect(page.getByText("未保存", { exact: true })).toBeVisible();

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "zip で保存" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^MyHandwriting_\d{8}-\d{4}\.zip$/,
  );
  await expect(page.getByText("未保存", { exact: true })).toBeHidden();

  const zipPath = await download.path();
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  expect(Object.keys(zip.files).sort()).toEqual(
    [
      "project.json",
      "fontfile/MyHandwriting.ttf",
      "fontfile/MyHandwriting.otf",
      "rawdata/vector/U+53E3.json",
      "rawdata/vector/U+5341.json",
      "rawdata/preview/U+53E3.png",
      "rawdata/preview/U+5341.png",
    ].sort(),
  );
  const json = JSON.parse(await zip.file("project.json")!.async("string"));
  expect(json.queue).toEqual(["口", "十", "未"]);
  expect(json.previewText).toBe("口十未作成");
  const png = await zip.file("rawdata/preview/U+53E3.png")!.async("uint8array");
  expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]); // "PNG"
  const vector = JSON.parse(
    await zip.file("rawdata/vector/U+5341.json")!.async("string"),
  );
  expect(vector.strokes).toHaveLength(2);

  // リロードすると消える（自動保存は #11）ので、zip から復元する
  await page.goto("/");
  await page.getByTestId("zip-input").setInputFiles(zipPath);
  await expect(page).toHaveURL(/\/editor\/?$/);
  await expect(
    page.getByRole("region", { name: "文字一覧" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(page.getByTestId("current-char")).toHaveText("未");
  await expect(page.getByLabel("登録済み文字数")).toHaveText("2 文字");
  await page
    .getByRole("region", { name: "文字一覧" })
    .getByRole("button", { name: /^十（/ })
    .click();
  await expect(page.getByTestId("drawing-canvas")).toHaveAttribute(
    "aria-label",
    /ストローク 2 本/,
  );
  await page
    .getByRole("navigation", { name: "ページ" })
    .getByRole("link", { name: "プレビュー" })
    .click();
  await expect(page.getByLabel("確かめたい文章")).toHaveValue("口十未作成");
  await expect(page.getByTestId("preview-area")).toHaveCSS(
    "font-family",
    /hw-preview-\d+/,
  );
});

test.describe("壊れた zip・無関係な zip を開いても落ちない", () => {
  // エラーの通知は出すが、コンソールのエラーにはしない
  test("zip でないファイル", async ({ page }) => {
    await page.goto("/");
    await page
      .getByTestId("zip-input")
      .setInputFiles({
        name: "broken.zip",
        mimeType: "application/zip",
        buffer: Buffer.from("not a zip"),
      });
    // Next.js のルートアナウンサーも role="alert" なので、文言で絞る
    await expect(page.getByRole("alert").filter({ hasText: "「broken.zip」を開けませんでした：zip ファイルではありません" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
  test("project.json のない zip", async ({ page }) => {
    const zip = new JSZip();
    zip.file("hello.txt", "hello");
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    await page.goto("/");
    await page
      .getByTestId("zip-input")
      .setInputFiles({
        name: "other.zip",
        mimeType: "application/zip",
        buffer,
      });
    // Next.js のルートアナウンサーも role="alert" なので、文言で絞る
    await expect(page.getByRole("alert").filter({ hasText: "このアプリで保存した zip ではありません" })).toBeVisible();
  });
});
