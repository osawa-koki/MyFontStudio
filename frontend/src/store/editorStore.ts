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
  /** 指（touch）の入力を無視する（パームリジェクション） */
  ignoreTouch: boolean;
  /** 利用者が「指の入力を無視」を自分で切り替えたか（切り替えたら、ペンを検出しても変えない） */
  ignoreTouchChosen: boolean;

  commitStroke(char: string, stroke: Stroke): void;
  undo(char: string): void;
  redo(char: string): void;
  clear(char: string): void;
  setPen(char: string, pen: Partial<PenParams>): void;
  /** 描きかけを捨てて、保存済みの線だけに戻す（その文字の履歴も消える） */
  discard(char: string): void;
  /** 文字ごとのペンを忘れる（プロジェクトを切り替えたときなど） */
  reset(): void;
  /** 利用者が「指の入力を無視」を切り替えた（ブラウザに覚えておく） */
  setIgnoreTouch(value: boolean): void;
  /**
   * ペンを検出したとき。利用者が自分で切り替えていなければ、指の入力を無視する。
   * 自動で ON にしたら true（呼び出し側で知らせる）
   */
  penDetected(): boolean;
}

/** 「指の入力を無視」の設定を覚えておくキー（ブラウザごとの好み。プロジェクトには入れない） */
export const IGNORE_TOUCH_KEY = "myfontstudio:ignoreTouch";

function loadIgnoreTouch(): boolean | null {
  try {
    // サーバーでの事前の描画（静的エクスポート）では読まない
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(IGNORE_TOUCH_KEY);
    return v === "true" ? true : v === "false" ? false : null;
  } catch {
    return null;
  }
}

function saveIgnoreTouch(value: boolean): void {
  try {
    window.localStorage.setItem(IGNORE_TOUCH_KEY, String(value));
  } catch {
    // プライベートブラウズなどで保存できなくても、この表示の間は効く
  }
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

const savedIgnoreTouch = loadIgnoreTouch();

export const useEditorStore = create<EditorState>()((set, get) => ({
  pens: {},
  ignoreTouch: savedIgnoreTouch ?? false,
  ignoreTouchChosen: savedIgnoreTouch !== null,
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
  setIgnoreTouch(value) {
    saveIgnoreTouch(value);
    set({ ignoreTouch: value, ignoreTouchChosen: true });
  },
  penDetected() {
    const { ignoreTouch, ignoreTouchChosen } = get();
    if (ignoreTouch || ignoreTouchChosen) return false;
    set({ ignoreTouch: true });
    return true;
  },
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
