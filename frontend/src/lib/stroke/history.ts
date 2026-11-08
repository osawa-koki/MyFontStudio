import type { DrawingHistory, HistoryOp, Stroke } from "../../types/project";

export type { DrawingHistory, HistoryOp };

/** 保存済みの線から履歴を作る（線を 1 本ずつ足した記録にするので、元に戻すで 1 本ずつ消せる） */
export function createHistory(strokes: readonly Stroke[] = []): DrawingHistory {
  return { ops: strokes.map((stroke) => ({ type: "add", stroke })), position: strokes.length };
}

const strokesCache = new WeakMap<DrawingHistory, Stroke[]>();

/** 履歴を適用した、今 Canvas にある線（履歴のオブジェクトごとにキャッシュする） */
export function strokesOf(h: DrawingHistory): Stroke[] {
  let strokes = strokesCache.get(h);
  if (!strokes) {
    strokes = [];
    for (const op of h.ops.slice(0, h.position)) {
      if (op.type === "add") strokes.push(op.stroke);
      else strokes = [];
    }
    strokesCache.set(h, strokes);
  }
  return strokes;
}

/** 1 文字の操作の数の上限。超えたら古い操作を、その時点の線にまとめて HISTORY_KEEP_OPS 個に減らす */
export const HISTORY_MAX_OPS = 5000;
export const HISTORY_KEEP_OPS = 4000;

/**
 * 古い操作をまとめて、操作の数を減らす。まとめた時点の線は 1 本ずつ足した記録として残すので、元に戻すことはできる
 * （まとめた時点より前のクリアの操作などは消える）
 */
export function compactHistory(h: DrawingHistory, keep = HISTORY_KEEP_OPS): DrawingHistory {
  if (h.ops.length <= keep) return h;
  const cut = h.ops.length - keep;
  if (h.position < cut) return h;
  const base = strokesOf({ ops: h.ops.slice(0, cut), position: cut });
  return {
    ops: [...base.map((stroke) => ({ type: "add" as const, stroke })), ...h.ops.slice(cut)],
    position: h.position - cut + base.length,
  };
}

/** 操作を足す。やり直しできる操作（position より後ろ）は捨てる。上限を超えたら古い操作をまとめる */
function push(h: DrawingHistory, op: HistoryOp): DrawingHistory {
  const next = { ops: [...h.ops.slice(0, h.position), op], position: h.position + 1 };
  return next.ops.length > HISTORY_MAX_OPS ? compactHistory(next) : next;
}

export function addStroke(h: DrawingHistory, stroke: Stroke): DrawingHistory {
  return push(h, { type: "add", stroke });
}

/** すべての線を消す（元に戻すで復帰できる）。線がなければそのまま */
export function clearStrokes(h: DrawingHistory): DrawingHistory {
  return strokesOf(h).length === 0 ? h : push(h, { type: "clear" });
}

export function undo(h: DrawingHistory): DrawingHistory {
  return h.position > 0 ? { ops: h.ops, position: h.position - 1 } : h;
}

export function redo(h: DrawingHistory): DrawingHistory {
  return h.position < h.ops.length ? { ops: h.ops, position: h.position + 1 } : h;
}

export const canUndo = (h: DrawingHistory) => h.position > 0;
export const canRedo = (h: DrawingHistory) => h.position < h.ops.length;

/** 保存済みの線と違うか（グリフとして保存していない描きかけがあるか） */
export function isDirty(h: DrawingHistory, saved: readonly Stroke[] | undefined): boolean {
  const strokes = strokesOf(h);
  const base = saved ?? [];
  if (strokes === base) return false;
  if (strokes.length !== base.length) return true;
  return strokes.some((s, i) => s !== base[i] && JSON.stringify(s) !== JSON.stringify(base[i]));
}
