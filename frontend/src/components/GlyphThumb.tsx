import { memo, useEffect, useRef, useState } from "react";
import { peekGlyphOutline } from "../lib/glyph/outline";
import { contoursToSvgPath } from "../lib/glyph/path";
import { outlineScheduler } from "../lib/glyph/scheduler";
import type { GlyphData } from "../types/project";

const pathOf = (glyph: GlyphData) => {
  const cached = peekGlyphOutline(glyph);
  return cached ? contoursToSvgPath(cached.contours) : null;
};

/**
 * グリフの輪郭のサムネイル（フォント座標を y 反転して表示する）。
 * 輪郭の計算は重いので、見えているものだけを、少しずつ区切って計算する（それまでは何も描かない）
 */
export const GlyphThumb = memo(function GlyphThumb({
  glyph,
  className = "h-8 w-8",
}: {
  glyph: GlyphData;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [computed, setComputed] = useState<{ glyph: GlyphData; d: string } | null>(null);
  const d = computed?.glyph === glyph ? computed.d : pathOf(glyph);

  useEffect(() => {
    if (d !== null) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void outlineScheduler.request(glyph).then((o) => {
          if (!cancelled) setComputed({ glyph, d: contoursToSvgPath(o.contours) });
        });
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [glyph, d]);

  return (
    <svg ref={ref} viewBox="0 -880 1000 1000" className={className} aria-hidden="true">
      {d !== null && <path d={d} transform="scale(1,-1)" fill="currentColor" fillRule="nonzero" />}
    </svg>
  );
});
