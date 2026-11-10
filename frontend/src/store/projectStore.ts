import { create } from "zustand";
import {
  createEmptyProject,
  sanitizeDisplayName,
  sanitizeFamilyName,
} from "../lib/project/project";
import { createProjectId } from "../lib/projects/repository";
import { createHistory } from "../lib/stroke/history";
import type {
  DrawingHistory,
  FontSettings,
  GlyphData,
  Project,
  ProjectDefaults,
} from "../types/project";

export interface ProjectState {
  project: Project;
  /** 入力ページで編集中の文字 */
  currentChar: string | null;
  /** 最後に zip に保存（または読み込み）してから変更があるか */
  dirty: boolean;
  /** 「zip 未保存」になる変更のたびに 1 増える番号（zip の保存を始めた時点と比べる） */
  revision: number;
  /** 開いているプロジェクトの ID（UUID。URL の ?uuid= と IndexedDB のキーに使う）。開いていなければ null */
  projectId: string | null;

  /** 新しいプロジェクトを開く。id を省略すると新しい UUID を振る。振った ID を返す */
  newProject(familyName?: string, id?: string): string;
  loadProject(project: Project, options: { id: string; dirty?: boolean }): void;
  /** プロジェクトを閉じる（開いていたものを削除したときなど） */
  closeProject(): void;
  setFontSettings(settings: Partial<FontSettings>): void;
  setDefaults(defaults: Partial<ProjectDefaults>): void;
  /** 文字一覧の末尾に追加する（重複は除く）。追加した文字を返す */
  addChars(chars: readonly string[]): string[];
  /** 文字一覧から削除する（作成済みのグリフも消す） */
  removeChar(char: string): void;
  saveGlyph(glyph: GlyphData): void;
  /** 文字の描いた履歴を変える（f に今の履歴を渡す。なければ保存済みの線から作った履歴） */
  updateDrawing(char: string, f: (h: DrawingHistory) => DrawingHistory): void;
  /** 文字の描いた履歴を、保存済みの線だけの状態に戻す（描きかけを捨てる） */
  resetDrawing(char: string): void;
  setCurrentChar(char: string | null): void;
  /** 文章を変える。dirty: false なら未保存にしない（初期値を入れるとき） */
  setPreviewText(text: string, options?: { dirty?: boolean }): void;
  /** 書き出しに成功したときに、書き出し回数を exportCount にする（今の値より小さければ変えない） */
  recordExport(exportCount: number): void;
  /** zip に保存した。revision（保存を始めた時点の番号）を渡すと、その後に変更があれば「zip 未保存」を残す */
  markSaved(revision?: number): void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createEmptyProject(),
  currentChar: null,
  dirty: false,
  revision: 0,
  projectId: null,

  newProject(familyName, id = createProjectId()) {
    set({
      project: createEmptyProject(familyName),
      currentChar: null,
      dirty: false,
      projectId: id,
    });
    return id;
  },

  loadProject(project, options) {
    set({ project, currentChar: null, dirty: options.dirty ?? false, projectId: options.id });
  },

  closeProject() {
    set({ project: createEmptyProject(), currentChar: null, dirty: false, projectId: null });
  },

  setFontSettings(settings) {
    const font = { ...get().project.font };
    if (settings.familyName !== undefined) {
      const name = sanitizeFamilyName(settings.familyName);
      if (name) font.familyName = name;
    }
    if (settings.familyNameJa !== undefined) {
      font.familyNameJa = sanitizeDisplayName(settings.familyNameJa);
    }
    if (settings.designer !== undefined) font.designer = sanitizeDisplayName(settings.designer);
    if (settings.exportCount !== undefined) font.exportCount = settings.exportCount;
    set((s) => ({ project: { ...s.project, font }, dirty: true, revision: s.revision + 1 }));
  },

  setDefaults(defaults) {
    set((s) => ({
      project: { ...s.project, defaults: { ...s.project.defaults, ...defaults } },
      dirty: true,
      revision: s.revision + 1,
    }));
  },

  addChars(chars) {
    const { queue } = get().project;
    const seen = new Set(queue);
    const added: string[] = [];
    for (const c of chars) {
      if (seen.has(c)) continue;
      seen.add(c);
      added.push(c);
    }
    if (added.length > 0) {
      set((s) => ({
        project: { ...s.project, queue: [...s.project.queue, ...added] },
        dirty: true,
        revision: s.revision + 1,
      }));
    }
    return added;
  },

  removeChar(char) {
    set((s) => {
      const glyphs = { ...s.project.glyphs };
      const drawings = { ...s.project.drawings };
      delete glyphs[char];
      delete drawings[char];
      return {
        project: {
          ...s.project,
          queue: s.project.queue.filter((c) => c !== char),
          glyphs,
          drawings,
        },
        currentChar: s.currentChar === char ? null : s.currentChar,
        dirty: true,
        revision: s.revision + 1,
      };
    });
  },

  saveGlyph(glyph) {
    set((s) => {
      const queue = s.project.queue.includes(glyph.char)
        ? s.project.queue
        : [...s.project.queue, glyph.char];
      return {
        project: { ...s.project, queue, glyphs: { ...s.project.glyphs, [glyph.char]: glyph } },
        dirty: true,
        revision: s.revision + 1,
      };
    });
  },

  updateDrawing(char, f) {
    set((s) => {
      const current = s.project.drawings[char] ?? createHistory(s.project.glyphs[char]?.strokes);
      const next = f(current);
      if (next === current && s.project.drawings[char]) return {};
      // 描いた履歴は zip に入る（rawdata/history/）ので、変えたら「zip 未保存」にする
      const changed = next !== current;
      return {
        project: { ...s.project, drawings: { ...s.project.drawings, [char]: next } },
        ...(changed ? { dirty: true, revision: s.revision + 1 } : {}),
      };
    });
  },

  resetDrawing(char) {
    set((s) => {
      if (!s.project.drawings[char]) return {};
      const drawings = { ...s.project.drawings };
      delete drawings[char];
      return { project: { ...s.project, drawings }, dirty: true, revision: s.revision + 1 };
    });
  },

  setCurrentChar(char) {
    set({ currentChar: char });
  },

  setPreviewText(text, options) {
    set((s) => ({
      project: { ...s.project, previewText: text },
      dirty: (options?.dirty ?? true) || s.dirty,
      revision: (options?.dirty ?? true) ? s.revision + 1 : s.revision,
    }));
  },

  recordExport(exportCount) {
    set((s) => {
      if (exportCount <= s.project.font.exportCount) return {};
      return { project: { ...s.project, font: { ...s.project.font, exportCount } } };
    });
  },

  markSaved(revision) {
    set((s) => (revision === undefined || revision === s.revision ? { dirty: false } : {}));
  },
}));
