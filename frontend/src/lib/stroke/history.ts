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

/** 操作を足す。やり直しできる操作（position より後ろ）は捨てる */
function push(h: DrawingHistory, op: HistoryOp): DrawingHistory {
  return { ops: [...h.ops.slice(0, h.position), op], position: h.position + 1 };
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
