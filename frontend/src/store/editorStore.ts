import { useMemo } from "react";
import { create } from "zustand";
import {
  addStroke,
  clearStrokes,
  createHistory,
  redo,
  undo,
  type DrawingHistory,
} from "../lib/stroke/history";
import type { PenParams, Stroke } from "../types/project";
import { useProjectStore } from "./projectStore";

/**
 * 入力ページの操作。描いた履歴はプロジェクト（project.drawings）に入れて保存する（zip にも入る）。
 * ここで持つのは、文字ごとのペンと、指の入力を無視するかだけ
 */
interface EditorState {
  /** 文字ごとのペンのパラメータ（作成済みの文字は保存したときの値から始める） */
  pens: Record<string, PenParams>;
  /** ペンを検出したら、指（touch）の入力を無視する（パームリジェクション） */
  ignoreTouch: boolean;

  commitStroke(char: string, stroke: Stroke): void;
  undo(char: string): void;
  redo(char: string): void;
  clear(char: string): void;
  setPen(char: string, pen: Partial<PenParams>): void;
  /** 描きかけを捨てて、保存済みの線だけに戻す（その文字の履歴も消える） */
  discard(char: string): void;
  /** 文字ごとのペンを忘れる（プロジェクトを切り替えたときなど） */
  reset(): void;
  setIgnoreTouch(value: boolean): void;
}

/** 文字の描いた履歴。なければ保存済みの線から作る */
export function historyFor(char: string): DrawingHistory {
  const { project } = useProjectStore.getState();
  return project.drawings[char] ?? createHistory(project.glyphs[char]?.strokes);
}

/** 文字のペン。なければ保存したときの値、未作成ならプロジェクトの初期値 */
export function penFor(state: EditorState, char: string): PenParams {
  const own = state.pens[char];
  if (own) return own;
  const glyph = useProjectStore.getState().project.glyphs[char];
  if (glyph) {
    const { size, thinning, smoothing, streamline } = glyph.pen;
    return { size, thinning, smoothing, streamline };
  }
  return useProjectStore.getState().project.defaults.pen;
}

const updateDrawing = (char: string, f: (h: DrawingHistory) => DrawingHistory) =>
  useProjectStore.getState().updateDrawing(char, f);

export const useEditorStore = create<EditorState>()((set, get) => ({
  pens: {},
  ignoreTouch: false,
  commitStroke: (char, stroke) => updateDrawing(char, (h) => addStroke(h, stroke)),
  undo: (char) => updateDrawing(char, undo),
  redo: (char) => updateDrawing(char, redo),
  clear: (char) => updateDrawing(char, clearStrokes),
  setPen(char, pen) {
    const next = { ...penFor(get(), char), ...pen };
    set((s) => ({ pens: { ...s.pens, [char]: next } }));
    // 以降に描く文字の初期値にもする
    const project = useProjectStore.getState();
    project.setDefaults({ pen: { ...project.project.defaults.pen, ...pen } });
  },
  discard(char) {
    useProjectStore.getState().resetDrawing(char);
    set((s) => {
      const pens = { ...s.pens };
      delete pens[char];
      return { pens };
    });
  },
  reset: () => set({ pens: {} }),
  setIgnoreTouch: (value) => set({ ignoreTouch: value }),
}));

const NO_STROKES: Stroke[] = [];

/** 画面用：文字の描いた履歴（セレクターが毎回新しいオブジェクトを返さないよう、値を選んでから組み立てる） */
export function useHistory(char: string): DrawingHistory {
  const own = useProjectStore((s) => s.project.drawings[char]);
  const saved = useProjectStore((s) => s.project.glyphs[char]?.strokes);
  return useMemo(() => own ?? createHistory(saved ?? NO_STROKES), [own, saved]);
}

/** 画面用：文字のペン */
export function usePen(char: string): PenParams {
  const own = useEditorStore((s) => s.pens[char]);
  const glyphPen = useProjectStore((s) => s.project.glyphs[char]?.pen);
  const defaults = useProjectStore((s) => s.project.defaults.pen);
  return useMemo(() => {
    if (own) return own;
    if (glyphPen) {
      const { size, thinning, smoothing, streamline } = glyphPen;
      return { size, thinning, smoothing, streamline };
    }
    return defaults;
  }, [own, glyphPen, defaults]);
}
