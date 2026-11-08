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

/** 入力ページの描きかけの状態（保存するまでプロジェクトには入れない） */
interface EditorState {
  /** 文字ごとの描きかけのストロークと履歴 */
  histories: Record<string, DrawingHistory>;
  /** 文字ごとのペンのパラメータ（作成済みの文字は保存したときの値から始める） */
  pens: Record<string, PenParams>;
  /** ペンを検出したら、指（touch）の入力を無視する（パームリジェクション） */
  ignoreTouch: boolean;

  commitStroke(char: string, stroke: Stroke): void;
  undo(char: string): void;
  redo(char: string): void;
  clear(char: string): void;
  setPen(char: string, pen: Partial<PenParams>): void;
  /** 描きかけを捨てて、保存済みの状態に戻す */
  discard(char: string): void;
  /** すべての描きかけを捨てる（プロジェクトを読み込んだときなど） */
  reset(): void;
  setIgnoreTouch(value: boolean): void;
}

/** 文字の描きかけの状態。なければ保存済みのストロークから始める */
export function historyFor(state: EditorState, char: string): DrawingHistory {
  return (
    state.histories[char] ??
    createHistory(useProjectStore.getState().project.glyphs[char]?.strokes ?? [])
  );
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

export const useEditorStore = create<EditorState>()((set, get) => {
  const update = (char: string, f: (h: DrawingHistory) => DrawingHistory) =>
    set((s) => ({ histories: { ...s.histories, [char]: f(historyFor(get(), char)) } }));
  return {
    histories: {},
    pens: {},
    ignoreTouch: false,
    commitStroke: (char, stroke) => update(char, (h) => addStroke(h, stroke)),
    undo: (char) => update(char, undo),
    redo: (char) => update(char, redo),
    clear: (char) => update(char, clearStrokes),
    setPen(char, pen) {
      const next = { ...penFor(get(), char), ...pen };
      set((s) => ({ pens: { ...s.pens, [char]: next } }));
      // 以降に描く文字の初期値にもする
      const project = useProjectStore.getState();
      project.setDefaults({ pen: { ...project.project.defaults.pen, ...pen } });
    },
    discard(char) {
      set((s) => {
        const histories = { ...s.histories };
        const pens = { ...s.pens };
        delete histories[char];
        delete pens[char];
        return { histories, pens };
      });
    },
    reset: () => set({ histories: {}, pens: {} }),
    setIgnoreTouch: (value) => set({ ignoreTouch: value }),
  };
});

const NO_STROKES: Stroke[] = [];

/** 画面用：文字の描きかけの状態（セレクターが毎回新しいオブジェクトを返さないよう、値を選んでから組み立てる） */
export function useHistory(char: string): DrawingHistory {
  const own = useEditorStore((s) => s.histories[char]);
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
