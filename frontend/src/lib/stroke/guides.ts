import { BASELINE_Y, CAP_HEIGHT, EM, SAFE_MARGIN, X_HEIGHT, ASCENDER } from "../glyph/constants";

export interface GuideLine {
  kind: "frame" | "center" | "baseline" | "safe" | "xHeight" | "capHeight";
  /** em 座標（Canvas、y 下向き）の線分 */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

/** Canvas に描くガイド線（仕様 4.3）。半角文字のときは英字用のガイドも出す */
export function guideLines(halfWidth: boolean): GuideLine[] {
  const s = SAFE_MARGIN;
  const e = EM - SAFE_MARGIN;
  const lines: GuideLine[] = [
    { kind: "frame", x1: 0, y1: 0, x2: EM, y2: 0, dashed: false },
    { kind: "frame", x1: EM, y1: 0, x2: EM, y2: EM, dashed: false },
    { kind: "frame", x1: EM, y1: EM, x2: 0, y2: EM, dashed: false },
    { kind: "frame", x1: 0, y1: EM, x2: 0, y2: 0, dashed: false },
    { kind: "center", x1: EM / 2, y1: 0, x2: EM / 2, y2: EM, dashed: true },
    { kind: "center", x1: 0, y1: EM / 2, x2: EM, y2: EM / 2, dashed: true },
    { kind: "safe", x1: s, y1: s, x2: e, y2: s, dashed: true },
    { kind: "safe", x1: e, y1: s, x2: e, y2: e, dashed: true },
    { kind: "safe", x1: e, y1: e, x2: s, y2: e, dashed: true },
    { kind: "safe", x1: s, y1: e, x2: s, y2: s, dashed: true },
    { kind: "baseline", x1: 0, y1: BASELINE_Y, x2: EM, y2: BASELINE_Y, dashed: false },
  ];
  if (halfWidth) {
    const xh = ASCENDER - X_HEIGHT;
    const cap = ASCENDER - CAP_HEIGHT;
    lines.push(
      { kind: "xHeight", x1: 0, y1: xh, x2: EM, y2: xh, dashed: true },
      { kind: "capHeight", x1: 0, y1: cap, x2: EM, y2: cap, dashed: true },
    );
  }
  return lines;
}
