import { NOTDEF_BOX } from "../lib/font/glyphs";

// .notdef と同じ形（枠と×。フォント座標を y 反転して描く）。送り幅 1000 = 1em
const { x0, y0, x1, y1, stroke: w } = NOTDEF_BOX;

/**
 * 未作成の文字の代わりに置く、生成フォントの .notdef と同じ形の箱。
 * CSS ではフォールバックを止められず、ブラウザに .notdef そのものを表示させられないため（仕様 8.2）
 */
export function NotdefBox({ char }: { char: string }) {
  return (
    <svg
      viewBox="0 -880 1000 1000"
      className="inline-block h-[1em] w-[1em] align-[-0.12em]"
      role="img"
      aria-label={`未作成の文字「${char}」`}
    >
      <g transform="scale(1,-1)" fill="none" stroke="currentColor" strokeWidth={w}>
        <path d={`M${x0 + w / 2} ${y0 + w / 2}H${x1 - w / 2}V${y1 - w / 2}H${x0 + w / 2}Z`} />
        <path
          d={`M${x0 + w} ${y0 + w}L${x1 - w} ${y1 - w}M${x1 - w} ${y0 + w}L${x0 + w} ${y1 - w}`}
        />
      </g>
    </svg>
  );
}
