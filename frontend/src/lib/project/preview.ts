/** 未作成の判定から外す文字：改行・半角スペース・全角スペース（仕様 8.2） */
const EXCLUDED = new Set(["\n", "\r", " ", "　"]);

export interface PreviewSegment {
  text: string;
  /** 作成していない文字の並び */
  missing: boolean;
}

const isMissing = (c: string, created: ReadonlySet<string>) => !EXCLUDED.has(c) && !created.has(c);

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
