import type { Stroke } from "../../types/project";

/** 1 文字分の描きかけの状態。元に戻す/やり直しはストローク単位で、文字ごとに持つ */
export interface DrawingHistory {
  strokes: Stroke[];
  undoStack: Stroke[][];
  redoStack: Stroke[][];
}

/** 履歴に残す数の上限 */
export const HISTORY_LIMIT = 200;

export function createHistory(strokes: Stroke[] = []): DrawingHistory {
  return { strokes, undoStack: [], redoStack: [] };
}

function push(h: DrawingHistory, strokes: Stroke[]): DrawingHistory {
  return {
    strokes,
    undoStack: [...h.undoStack, h.strokes].slice(-HISTORY_LIMIT),
    redoStack: [],
  };
}

export function addStroke(h: DrawingHistory, stroke: Stroke): DrawingHistory {
  return push(h, [...h.strokes, stroke]);
}

/** すべてのストロークを消す（元に戻すで復帰できる） */
export function clearStrokes(h: DrawingHistory): DrawingHistory {
  return h.strokes.length === 0 ? h : push(h, []);
}

export function undo(h: DrawingHistory): DrawingHistory {
  const prev = h.undoStack[h.undoStack.length - 1];
  if (!prev) return h;
  return {
    strokes: prev,
    undoStack: h.undoStack.slice(0, -1),
    redoStack: [...h.redoStack, h.strokes],
  };
}

export function redo(h: DrawingHistory): DrawingHistory {
  const next = h.redoStack[h.redoStack.length - 1];
  if (!next) return h;
  return {
    strokes: next,
    undoStack: [...h.undoStack, h.strokes],
    redoStack: h.redoStack.slice(0, -1),
  };
}

export const canUndo = (h: DrawingHistory) => h.undoStack.length > 0;
export const canRedo = (h: DrawingHistory) => h.redoStack.length > 0;

/** 保存済みのストロークと違うか（未保存の変更があるか） */
export function isDirty(h: DrawingHistory, saved: readonly Stroke[] | undefined): boolean {
  const base = saved ?? [];
  if (h.strokes === base) return false;
  if (h.strokes.length !== base.length) return true;
  return JSON.stringify(h.strokes) !== JSON.stringify(base);
}
