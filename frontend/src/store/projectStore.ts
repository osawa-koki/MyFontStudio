import { create } from "zustand";
import {
  createEmptyProject,
  sanitizeDisplayName,
  sanitizeFamilyName,
} from "../lib/project/project";
import type { FontSettings, GlyphData, Project, ProjectDefaults } from "../types/project";

export interface ProjectState {
  project: Project;
  /** 入力ページで編集中の文字 */
  currentChar: string | null;
  /** 最後に zip に保存（または読み込み）してから変更があるか */
  dirty: boolean;
  /** 作業中のプロジェクトがあるか（新しくはじめた・読み込んだ・復元した） */
  started: boolean;

  newProject(familyName?: string): void;
  loadProject(project: Project, options?: { dirty?: boolean }): void;
  setFontSettings(settings: Partial<FontSettings>): void;
  setDefaults(defaults: Partial<ProjectDefaults>): void;
  /** 文字一覧の末尾に追加する（重複は除く）。追加した文字を返す */
  addChars(chars: readonly string[]): string[];
  /** 文字一覧から削除する（作成済みのグリフも消す） */
  removeChar(char: string): void;
  saveGlyph(glyph: GlyphData): void;
  setCurrentChar(char: string | null): void;
  setPreviewText(text: string): void;
  /** 書き出し回数を 1 加算し、新しい値を返す */
  incrementExportCount(): number;
  markSaved(): void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createEmptyProject(),
  currentChar: null,
  dirty: false,
  started: false,

  newProject(familyName) {
    set({
      project: createEmptyProject(familyName),
      currentChar: null,
      dirty: false,
      started: true,
    });
  },

  loadProject(project, options) {
    set({
      project,
      currentChar: null,
      dirty: options?.dirty ?? false,
      started: true,
    });
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
    set((s) => ({ project: { ...s.project, font }, dirty: true, started: true }));
  },

  setDefaults(defaults) {
    set((s) => ({
      project: { ...s.project, defaults: { ...s.project.defaults, ...defaults } },
      dirty: true,
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
        started: true,
      }));
    }
    return added;
  },

  removeChar(char) {
    set((s) => {
      const glyphs = { ...s.project.glyphs };
      delete glyphs[char];
      return {
        project: { ...s.project, queue: s.project.queue.filter((c) => c !== char), glyphs },
        currentChar: s.currentChar === char ? null : s.currentChar,
        dirty: true,
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
        started: true,
      };
    });
  },

  setCurrentChar(char) {
    set({ currentChar: char });
  },

  setPreviewText(text) {
    set((s) => ({ project: { ...s.project, previewText: text }, dirty: true }));
  },

  incrementExportCount() {
    const exportCount = get().project.font.exportCount + 1;
    set((s) => ({ project: { ...s.project, font: { ...s.project.font, exportCount } } }));
    return exportCount;
  },

  markSaved() {
    set({ dirty: false });
  },
}));
