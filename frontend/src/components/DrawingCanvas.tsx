import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ASCENDER, EM } from "../lib/glyph/constants";
import { strokeToRing } from "../lib/glyph/outline";
import { guideLines, type GuideLine } from "../lib/stroke/guides";
import { appendPoint, clientToEm, resolvePressure } from "../lib/stroke/record";
import type { PenParams, Stroke, StrokePoint } from "../types/project";

interface Props {
  char: string;
  /** 確定したストローク */
  strokes: readonly Stroke[];
  pen: PenParams;
  usePressure: boolean;
  showModel: boolean;
  /** 半角の文字（英字用のガイドを出す） */
  halfWidth: boolean;
  /** 指（touch）の入力を無視する */
  ignoreTouch: boolean;
  onStroke(stroke: Stroke): void;
  /** ペンの入力を初めて検出したとき */
  onPenDetected(): void;
}

const GUIDE_STYLE: Record<GuideLine["kind"], string> = {
  frame: "#94a3b8",
  center: "#cbd5e1",
  safe: "#cbd5e1",
  baseline: "#60a5fa",
  xHeight: "#86efac",
  capHeight: "#86efac",
};

const INK = "#0f172a";

/** ストロークの輪郭（em 座標）を Path2D にする。ペンが同じならキャッシュを使う */
const pathCache = new WeakMap<Stroke, { key: string; path: Path2D }>();
function strokePath(stroke: Stroke, pen: PenParams): Path2D {
  const key = `${pen.size}/${pen.thinning}/${pen.smoothing}/${pen.streamline}`;
  const cached = pathCache.get(stroke);
  if (cached?.key === key) return cached.path;
  const ring = strokeToRing(stroke, { ...pen, simulatePressure: false });
  const path = new Path2D();
  ring.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
  pathCache.set(stroke, { key, path });
  return path;
}

/** 各ストロークの輪郭を 1 つの Path2D にまとめ、nonzero で塗る（合成後のフォントと同じ形になる） */
function fillStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], pen: PenParams) {
  const all = new Path2D();
  for (const s of strokes) all.addPath(strokePath(s, pen));
  ctx.fillStyle = INK;
  ctx.fill(all, "nonzero");
}

/** 手書きの Canvas。座標は 0〜1000 の em 座標で記録する（表示サイズによらない） */
export function DrawingCanvas(props: Props) {
  const { char, strokes, pen, showModel, halfWidth } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const active = useRef<{ pointerId: number; points: StrokePoint[]; simulate: boolean } | null>(
    null,
  );
  const frame = useRef(0);
  // ハンドラーから最新の props を読む
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  // 表示サイズに合わせる（devicePixelRatio を考慮して高解像度にする）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prepare = useCallback(
    (canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null => {
      if (!canvas || size === 0) return null;
      const dpr = window.devicePixelRatio || 1;
      const px = Math.round(size * dpr);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      ctx.setTransform(px / EM, 0, 0, px / EM, 0, 0);
      return ctx;
    },
    [size],
  );

  // 下の層：ガイド・お手本・確定したストローク
  useEffect(() => {
    const ctx = prepare(baseRef.current);
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EM, EM);
    if (showModel && char) {
      // お手本：既存のフォント（sans-serif）で薄く表示する。グリフのデータには含めない
      ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      if (halfWidth) {
        // 英字はキャップハイト（700）がガイドに合う大きさで、ベースラインに置く
        ctx.font = `970px sans-serif`;
        ctx.fillText(char, EM / 2, ASCENDER);
      } else {
        // 全角は推奨描画範囲に収まる大きさで置く
        ctx.font = `900px sans-serif`;
        ctx.fillText(char, EM / 2, 50 + 900 * 0.88);
      }
    }
    ctx.lineWidth = 2;
    for (const l of guideLines(halfWidth)) {
      ctx.strokeStyle = GUIDE_STYLE[l.kind];
      ctx.setLineDash(l.dashed ? [12, 10] : []);
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    fillStrokes(ctx, strokes, pen);
  }, [prepare, strokes, pen, showModel, char, halfWidth]);

  // 上の層：描いている途中のストローク
  const drawLive = useCallback(() => {
    frame.current = 0;
    const ctx = prepare(liveRef.current);
    const cur = active.current;
    if (!ctx || !cur || cur.points.length === 0) return;
    fillStrokes(ctx, [{ points: cur.points, simulatePressure: cur.simulate }], latest.current.pen);
  }, [prepare]);

  const scheduleLive = () => {
    if (!frame.current) frame.current = requestAnimationFrame(drawLive);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const addPoints = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = active.current;
    const canvas = liveRef.current;
    if (!cur || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const [x, y] = clientToEm(ev.clientX, ev.clientY, rect);
      const { pressure } = resolvePressure(ev.pointerType, ev.pressure, latest.current.usePressure);
      appendPoint(cur.points, x, y, pressure);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "pen") latest.current.onPenDetected();
    if (e.pointerType === "touch" && latest.current.ignoreTouch) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (active.current) return; // 2 本目の指などは無視する
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // キャプチャできなくても描ける（Canvas の外に出ると線が途切れるだけ）
    }
    const { simulate } = resolvePressure(e.pointerType, e.pressure, latest.current.usePressure);
    active.current = { pointerId: e.pointerId, points: [], simulate };
    addPoints(e);
    scheduleLive();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current?.pointerId !== e.pointerId) return;
    addPoints(e);
    scheduleLive();
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const cur = active.current;
    if (cur?.pointerId !== e.pointerId) return;
    active.current = null;
    // pointercancel（ブラウザが入力を取り上げたとき）は描きかけを捨てる
    if (!cancelled && cur.points.length > 0) {
      latest.current.onStroke({ points: cur.points, simulatePressure: cur.simulate });
    }
    prepare(liveRef.current);
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-[560px] min-w-[280px] touch-none select-none sm:min-w-[360px]"
    >
      <canvas
        ref={baseRef}
        className="absolute inset-0 h-full w-full rounded-md border border-slate-300 shadow-inner"
        aria-hidden="true"
      />
      <canvas
        ref={liveRef}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        role="img"
        aria-label={`「${char}」の手書き入力欄（ストローク ${strokes.length} 本）`}
        data-testid="drawing-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
