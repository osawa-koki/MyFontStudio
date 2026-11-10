import { ASCENDER, EM } from "./constants";
import { contoursToSvgPath } from "./path";
import type { Contour } from "./types";

export const PREVIEW_PNG_SIZE = 256;

/**
 * グリフの輪郭（フォント座標）から、プレビュー PNG（256×256、白背景に黒）を作る。
 * OffscreenCanvas（Web Worker でも使える）がなければ通常の Canvas を使う
 */
export async function renderOutlinePng(contours: readonly Contour[]): Promise<Uint8Array> {
  const size = PREVIEW_PNG_SIZE;
  const offscreen = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : null;
  const canvas =
    offscreen ?? Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Canvas が使えません");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // フォント座標（y 上向き、ベースライン 0）→ 画像の座標
  const s = size / EM;
  ctx.setTransform(s, 0, 0, -s, 0, ASCENDER * s);
  ctx.fillStyle = "#000000";
  ctx.fill(new Path2D(contoursToSvgPath(contours)), "nonzero");
  const blob = offscreen
    ? await offscreen.convertToBlob({ type: "image/png" })
    : await new Promise<Blob>((resolve, reject) =>
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PNG を作れません"))),
          "image/png",
        ),
      );
  return new Uint8Array(await blob.arrayBuffer());
}
