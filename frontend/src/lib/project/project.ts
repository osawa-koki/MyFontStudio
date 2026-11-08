import type { PenParams, Project } from "../../types/project";

export const DEFAULT_FAMILY_NAME = "MyHandwriting";
export const FAMILY_NAME_MAX = 31;

export const DEFAULT_PEN: PenParams = {
  size: 40,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
};

/** 太さのスライダーの範囲（em 1000 に対する値） */
export const PEN_SIZE_MIN = 15;
export const PEN_SIZE_MAX = 100;

export function createEmptyProject(familyName: string = DEFAULT_FAMILY_NAME): Project {
  return {
    font: {
      familyName: sanitizeFamilyName(familyName) || DEFAULT_FAMILY_NAME,
      familyNameJa: "",
      designer: "",
      exportCount: 0,
    },
    defaults: { pen: { ...DEFAULT_PEN }, usePressure: true, showModel: true },
    queue: [],
    previewText: "",
    glyphs: {},
  };
}

/** familyName に使えない文字（英数字以外）を取り除き、31 文字に切る */
export function sanitizeFamilyName(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, FAMILY_NAME_MAX);
}

/** 日本語名などの自由入力の名前：制御文字を取り除き、前後の空白を落として 31 文字に切る */
export function sanitizeDisplayName(name: string): string {
  return Array.from(name.replace(/\p{Cc}/gu, "").trim())
    .slice(0, FAMILY_NAME_MAX)
    .join("");
}

/** 文字 → "U+3042" */
export function toCodepointLabel(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error("空の文字");
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

const CODEPOINT_LABEL = /^U\+([0-9A-F]{4,6})$/;

/** "U+3042" → 文字。形が正しくなければ null */
export function fromCodepointLabel(label: string): string | null {
  const m = CODEPOINT_LABEL.exec(label);
  if (!m?.[1]) return null;
  const cp = parseInt(m[1], 16);
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
  return String.fromCodePoint(cp);
}

/** 作成済み（ストロークが 1 本以上ある）グリフの数 */
export function countGlyphs(project: Project): number {
  return Object.values(project.glyphs).filter((g) => g.strokes.length > 0).length;
}
