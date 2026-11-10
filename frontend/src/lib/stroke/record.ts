import { ASCENDER } from "../glyph/constants";
import { WIN_ASCENT, WIN_DESCENT } from "../font/metrics";
import type { PenParams, Stroke, StrokePoint } from "../../types/project";

/** 前の点からこれ未満の移動は間引く（em 単位） */
export const MIN_POINT_DISTANCE = 2;

/** x, y は小数点以下 1 桁、pressure は 2 桁に丸める */
export function roundPoint(x: number, y: number, pressure: number): StrokePoint {
  const p = Math.min(1, Math.max(0, pressure));
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100];
}

/**
 * 点を記録する。前の点から MIN_POINT_DISTANCE 未満なら追加しない。
 * 追加したら true
 */
export function appendPoint(
  points: StrokePoint[],
  x: number,
  y: number,
  pressure: number,
): boolean {
  const pt = roundPoint(x, y, pressure);
  const last = points[points.length - 1];
  if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < MIN_POINT_DISTANCE) return false;
  points.push(pt);
  return true;
}

/** 画面上の座標（clientX/Y）を、Canvas の em 座標（0〜1000）にする */
export function clientToEm(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): [number, number] {
  return [((clientX - rect.left) / rect.width) * 1000, ((clientY - rect.top) / rect.height) * 1000];
}

/**
 * PointerEvent から筆圧を決める。
 * - 筆圧 OFF：0.5 固定（太さ一定）で推定もしない
 * - ペン：pressure を使う（0 のときは 0.5 にする。押し始めに 0 を返す端末があるため）
 * - それ以外（マウス・指）：速度から推定する
 */
export function resolvePressure(
  pointerType: string,
  pressure: number,
  usePressure: boolean,
): { pressure: number; simulate: boolean } {
  if (!usePressure) return { pressure: 0.5, simulate: false };
  if (pointerType === "pen") return { pressure: pressure > 0 ? pressure : 0.5, simulate: false };
  return { pressure: 0.5, simulate: true };
}

/** 左右は枠の外のこの幅まで記録する（em 単位。半角の文字の送り幅は描いた幅で決まるので、左右は欠けない） */
export const DRAW_SIDE_MARGIN = 200;

/**
 * 描いた点を記録する範囲（Canvas の em 座標）。枠の外にはみ出した描画は保持するが（仕様 5.3）、
 * 上下は Windows で欠けない範囲（usWinAscent・usWinDescent の内側。Canvas の y=-120〜1080）から、
 * 線の太さの半分（筆圧で最も太くなったとき）を引いた範囲に収める
 */
export function drawingBounds(pen: Pick<PenParams, "size" | "thinning">): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  // perfect-freehand の線の半径は size × (0.5 − thinning × (0.5 − pressure))。pressure は 0〜1
  const radius = pen.size * (0.5 + Math.abs(pen.thinning) * 0.5);
  return {
    xMin: -DRAW_SIDE_MARGIN,
    xMax: 1000 + DRAW_SIDE_MARGIN,
    yMin: ASCENDER - WIN_ASCENT + radius,
    yMax: ASCENDER + WIN_DESCENT - radius,
  };
}

/** 点を、記録する範囲（drawingBounds）に収める */
export function clampToDrawingArea(
  x: number,
  y: number,
  pen: Pick<PenParams, "size" | "thinning">,
): [number, number] {
  const b = drawingBounds(pen);
  return [Math.min(b.xMax, Math.max(b.xMin, x)), Math.min(b.yMax, Math.max(b.yMin, y))];
}

/** 枠（0〜1000）の外に出た点のある線があるか（Canvas では枠の外は見えないので、知らせるのに使う） */
export function hasStrokeOutsideFrame(strokes: readonly Stroke[]): boolean {
  return strokes.some((s) => s.points.some(([x, y]) => x < 0 || x > 1000 || y < 0 || y > 1000));
}
