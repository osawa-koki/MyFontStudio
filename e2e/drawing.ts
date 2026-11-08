import type { Page } from "@playwright/test";

/** Canvas の em 座標（0〜1000）で、点を結ぶ線をマウスで描く */
export async function drawStroke(page: Page, points: [number, number][]): Promise<void> {
  const canvas = page.getByTestId("drawing-canvas");
  // 上に固定しているヘッダーに重ならないよう、Canvas を画面の中央に出してから描く
  // （ボタンを押すとき Playwright がページをスクロールし、Canvas の上の端がヘッダーの下に隠れることがある）
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas が見えない");
  const at = ([x, y]: [number, number]) =>
    [box.x + (x / 1000) * box.width, box.y + (y / 1000) * box.height] as const;
  const [first, ...rest] = points;
  if (!first) return;
  await page.mouse.move(...at(first));
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(...at(p), { steps: 8 });
  await page.mouse.up();
}
