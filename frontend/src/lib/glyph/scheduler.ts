import { getGlyphOutline, peekGlyphOutline } from "./outline";
import type { GlyphOutline } from "./types";
import type { GlyphData } from "../../types/project";

/**
 * 輪郭の計算を、少しずつ区切って行う（たくさんのサムネイルを一度に出すときに画面を止めない）。
 * 同じグリフを何度頼んでも 1 回だけ計算する
 */
export function createOutlineScheduler(
  options: {
    /** 1 回に使う時間（ミリ秒） */
    sliceMs?: number;
    /** 次の区切りまで処理を譲る */
    yieldFn?: (run: () => void) => void;
    now?: () => number;
  } = {},
) {
  const sliceMs = options.sliceMs ?? 8;
  const yieldFn = options.yieldFn ?? ((run) => setTimeout(run, 0));
  const now = options.now ?? (() => performance.now());
  const queue: GlyphData[] = [];
  const waiting = new Map<GlyphData, Promise<GlyphOutline>>();
  const resolvers = new Map<GlyphData, (o: GlyphOutline) => void>();
  let running = false;

  const run = () => {
    const start = now();
    // 1 回の区切りで、少なくとも 1 つは計算する（遅い端末でも進むように）
    do {
      const glyph = queue.shift();
      if (!glyph) break;
      const outline = getGlyphOutline(glyph);
      resolvers.get(glyph)?.(outline);
      resolvers.delete(glyph);
      waiting.delete(glyph);
    } while (queue.length > 0 && now() - start < sliceMs);
    if (queue.length > 0) yieldFn(run);
    else running = false;
  };

  return {
    /** 輪郭を求める。キャッシュにあればすぐに返す */
    request(glyph: GlyphData): Promise<GlyphOutline> {
      const cached = peekGlyphOutline(glyph);
      if (cached) return Promise.resolve(cached);
      const pending = waiting.get(glyph);
      if (pending) return pending;
      const promise = new Promise<GlyphOutline>((resolve) => resolvers.set(glyph, resolve));
      waiting.set(glyph, promise);
      queue.push(glyph);
      if (!running) {
        running = true;
        yieldFn(run);
      }
      return promise;
    },
    /** まだ計算していないグリフの数 */
    pending: () => queue.length,
  };
}

/** 画面で使う、ただ 1 つのスケジューラー */
export const outlineScheduler = createOutlineScheduler();
