import type { Contour } from "./types";

/**
 * 輪郭を SVG の path（フォント座標のまま。表示するときは y を反転する）にする。
 * onCurve が続けば直線、間に offCurve が 1 つあれば二次ベジェ。offCurve が続くときは中点を補う
 */
export function contoursToSvgPath(contours: readonly Contour[]): string {
  const parts: string[] = [];
  for (const contour of contours) {
    const n = contour.length;
    if (n === 0) continue;
    const start = contour.findIndex((p) => p.onCurve);
    // すべて offCurve なら、最初の 2 点の中点から始める
    const first = contour[start === -1 ? 0 : start]!;
    const startPoint =
      start === -1
        ? { x: (first.x + contour[1 % n]!.x) / 2, y: (first.y + contour[1 % n]!.y) / 2 }
        : first;
    const offset = start === -1 ? 0 : start;
    parts.push(`M${startPoint.x} ${startPoint.y}`);
    let pending: { x: number; y: number } | null = null;
    for (let k = 1; k <= n; k++) {
      const p = contour[(offset + k) % n]!;
      const isStart = k === n && start !== -1;
      const point = isStart ? startPoint : p;
      if (p.onCurve || isStart) {
        if (pending) {
          parts.push(`Q${pending.x} ${pending.y} ${point.x} ${point.y}`);
          pending = null;
        } else {
          parts.push(`L${point.x} ${point.y}`);
        }
      } else if (pending) {
        const mid = { x: (pending.x + p.x) / 2, y: (pending.y + p.y) / 2 };
        parts.push(`Q${pending.x} ${pending.y} ${mid.x} ${mid.y}`);
        pending = p;
      } else {
        pending = p;
      }
    }
    if (pending) parts.push(`Q${pending.x} ${pending.y} ${startPoint.x} ${startPoint.y}`);
    parts.push("Z");
  }
  return parts.join("");
}
