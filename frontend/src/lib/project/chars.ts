import type { GlyphData } from "../../types/project";

/** 黙って除外する文字：空白・改行・制御文字 */
const IGNORED = /^[\p{White_Space}\p{Cc}\p{Cf}]$/u;
/** 対応していない文字として通知する：結合文字・異体字セレクタ・絵文字・地域指示子・私用領域・サロゲート単体 */
const UNSUPPORTED =
  /^(?:\p{M}|[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}]|\p{Emoji_Presentation}|\p{Regional_Indicator}|\p{Co}|\p{Cs})$/u;

export interface ParsedChars {
  /** 取り込む文字（入力順、重複なし） */
  accepted: string[];
  /** 対応していない文字（重複なし） */
  unsupported: string[];
}

/**
 * 入力された文字列を、取り込む文字に分ける（仕様 4.2）。
 * NFC 正規化 → コードポイント単位に分割 → 空白・制御文字は除外 → 対応していない文字は別にする → 重複を除く
 */
export function parseInputChars(text: string): ParsedChars {
  const accepted: string[] = [];
  const unsupported: string[] = [];
  const seen = new Set<string>();
  for (const c of Array.from(text.normalize("NFC"))) {
    if (seen.has(c)) continue;
    seen.add(c);
    if (IGNORED.test(c)) continue;
    if (UNSUPPORTED.test(c)) unsupported.push(c);
    else accepted.push(c);
  }
  return { accepted, unsupported };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));

/** プリセット（仕様 4.1） */
export const PRESETS: { id: string; label: string; chars: string[] }[] = [
  { id: "hiragana", label: "ひらがな", chars: [...range(0x3041, 0x3093), "ゝ", "ゞ"] },
  { id: "katakana", label: "カタカナ", chars: [...range(0x30a1, 0x30f6), "ー", "ヽ", "ヾ"] },
  { id: "digits", label: "数字", chars: range(0x30, 0x39) },
  { id: "latin", label: "英字", chars: [...range(0x41, 0x5a), ...range(0x61, 0x7a)] },
  {
    id: "symbols",
    label: "記号",
    chars: [
      ...range(0x21, 0x2f),
      ...range(0x3a, 0x40),
      ...range(0x5b, 0x60),
      ...range(0x7b, 0x7e),
      ...Array.from("。、・「」『』（）【】！？〜…"),
    ],
  },
];

export const isCreated = (glyphs: Record<string, GlyphData>, c: string) =>
  (glyphs[c]?.strokes.length ?? 0) > 0;

/** 一覧で from の次から順に（最後まで行ったら先頭から）探した、最初の未作成の文字。なければ null */
export function nextUncreated(
  queue: readonly string[],
  glyphs: Record<string, GlyphData>,
  from: string | null,
): string | null {
  const start = from === null ? -1 : queue.indexOf(from);
  for (let k = 1; k <= queue.length; k++) {
    const c = queue[(start + k + queue.length) % queue.length]!;
    if (c !== from && !isCreated(glyphs, c)) return c;
  }
  return null;
}

/** 一覧上のひとつ前の文字（先頭なら null） */
export function prevChar(queue: readonly string[], char: string | null): string | null {
  const i = char === null ? -1 : queue.indexOf(char);
  return i > 0 ? queue[i - 1]! : null;
}

/** 現在時刻を、ローカルのタイムゾーンのオフセット付きの ISO 8601 にする（例：2026-11-07T20:30:00+09:00） */
export function isoWithOffset(date: Date = new Date()): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}
