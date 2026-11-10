import { parseInputChars } from "./chars";

/** 未作成の判定から外す文字：改行・半角スペース・全角スペースなどの空白と、制御文字（仕様 8.2。文字一覧にも追加しない文字） */
const EXCLUDED = /^[\p{White_Space}\p{Cc}\p{Cf}]$/u;

export interface PreviewSegment {
  text: string;
  /** 作成していない文字の並び */
  missing: boolean;
}

const isMissing = (c: string, created: ReadonlySet<string>) => !EXCLUDED.test(c) && !created.has(c);

/** 文章を、作成済みの文字の並びと未作成の文字の並びに分ける（コードポイント単位） */
export function splitPreviewText(text: string, created: ReadonlySet<string>): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  for (const c of Array.from(text)) {
    const missing = isMissing(c, created);
    const last = segments[segments.length - 1];
    if (last && last.missing === missing) last.text += c;
    else segments.push({ text: c, missing });
  }
  return segments;
}

/** 文章の中の未作成の文字（重複なし、出てきた順） */
export function missingChars(text: string, created: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const c of Array.from(text)) if (isMissing(c, created)) out.add(c);
  return [...out];
}

/** 作成済みの文字を一覧の順に連結したもの（プレビューの文章の初期値） */
export function createdText(
  queue: readonly string[],
  glyphs: Readonly<Record<string, { strokes: readonly unknown[] } | undefined>>,
): string {
  return queue.filter((c) => (glyphs[c]?.strokes.length ?? 0) > 0).join("");
}

/** 「入力ページに追加して描く」の通知。added：実際に追加した文字、requested：追加しようとした文字 */
export function addMissingMessage(added: readonly string[], requested: readonly string[]): string {
  const already = requested.length - added.length;
  if (added.length === 0) return `${requested.length} 文字は、すべて入力ページの一覧にあります`;
  return (
    `${added.length} 文字を入力ページの一覧に追加しました` +
    (already > 0 ? `（${already} 文字はすでに一覧にあります）` : "")
  );
}

/** 未作成の文字を、入力ページの一覧に追加できる文字と、対応していない文字（絵文字・結合文字など）に分ける */
export function classifyMissing(missing: readonly string[]): {
  addable: string[];
  unsupported: string[];
} {
  const { accepted, unsupported } = parseInputChars(missing.join(""));
  return { addable: accepted, unsupported };
}
