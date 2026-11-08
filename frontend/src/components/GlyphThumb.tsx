import { memo } from "react";
import { getGlyphOutline } from "../lib/glyph/outline";
import { contoursToSvgPath } from "../lib/glyph/path";
import type { GlyphData } from "../types/project";

/** グリフの輪郭のサムネイル（フォント座標を y 反転して表示する） */
export const GlyphThumb = memo(function GlyphThumb({
  glyph,
  className = "h-8 w-8",
}: {
  glyph: GlyphData;
  className?: string;
}) {
  const d = contoursToSvgPath(getGlyphOutline(glyph).contours);
  return (
    <svg viewBox="0 -880 1000 1000" className={className} aria-hidden="true">
      <path d={d} transform="scale(1,-1)" fill="currentColor" fillRule="nonzero" />
    </svg>
  );
});
