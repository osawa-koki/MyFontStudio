import type { GlyphData } from "../../types/project";
import { toCodepointLabel } from "./project";

/** 並び順：登録順（一覧に追加した順）・文字コード順・更新日時順（グリフを保存した日時） */
export type SortKey = "added" | "codepoint" | "updated";
export type StatusFilter = "all" | "uncreated" | "created";
export type CharKind = "hiragana" | "katakana" | "kanji" | "latin" | "digit" | "symbol" | "other";
export type KindFilter = "all" | CharKind;

export interface QueueViewOptions {
  sort: SortKey;
  /** 降順（新しい順・大きい順） */
  desc: boolean;
  status: StatusFilter;
  kind: KindFilter;
  /** 検索：入力した文字そのもの（複数可）か、コードポイント（U+3042・3042 の一部） */
  query: string;
}

export const DEFAULT_VIEW: QueueViewOptions = {
  sort: "added",
  desc: false,
  status: "all",
  kind: "all",
  query: "",
};

export const KIND_LABELS: Record<CharKind, string> = {
  hiragana: "ひらがな",
  katakana: "カタカナ",
  kanji: "漢字",
  latin: "英字",
  digit: "数字",
  symbol: "記号",
  other: "その他",
};

/** 文字の種類 */
export function charKind(c: string): CharKind {
  if (/^\p{Script=Hiragana}$/u.test(c)) return "hiragana";
  // 長音符（ー）・カタカナの繰り返し記号は Common だが、カタカナとして扱う
  if (/^[\p{Script=Katakana}ー]$/u.test(c)) return "katakana";
  if (/^[\p{Script=Han}々〆]$/u.test(c)) return "kanji";
  if (/^\p{Script=Latin}$/u.test(c)) return "latin";
  if (/^\p{Nd}$/u.test(c)) return "digit";
  if (/^[\p{P}\p{S}]$/u.test(c)) return "symbol";
  return "other";
}

const HEX_QUERY = /^(?:u\+?)?([0-9a-f]{1,6})$/i;

/** 検索に合うか。入力に含まれる文字か、コードポイントの 16 進数を含むか（「U+30」「3042」） */
export function matchesQuery(c: string, query: string): boolean {
  const q = query.trim();
  if (q === "") return true;
  if (Array.from(q).includes(c)) return true;
  const hex = HEX_QUERY.exec(q)?.[1];
  return hex !== undefined && toCodepointLabel(c).slice(2).includes(hex.toUpperCase());
}

const isCreated = (glyphs: Record<string, GlyphData>, c: string) =>
  (glyphs[c]?.strokes.length ?? 0) > 0;

/** 文字一覧を、絞り込んで並べ替える */
export function viewQueue(
  queue: readonly string[],
  glyphs: Record<string, GlyphData>,
  options: QueueViewOptions,
): string[] {
  const filtered = queue.filter((c) => {
    if (options.status === "created" && !isCreated(glyphs, c)) return false;
    if (options.status === "uncreated" && isCreated(glyphs, c)) return false;
    if (options.kind !== "all" && charKind(c) !== options.kind) return false;
    return matchesQuery(c, options.query);
  });
  const dir = options.desc ? -1 : 1;
  if (options.sort === "added") return options.desc ? filtered.reverse() : filtered;
  const order = new Map(queue.map((c, i) => [c, i]));
  const tieBreak = (a: string, b: string) => order.get(a)! - order.get(b)!;
  if (options.sort === "codepoint") {
    return filtered.sort((a, b) => dir * (a.codePointAt(0)! - b.codePointAt(0)!) || tieBreak(a, b));
  }
  // 更新日時順：未作成の文字（日時なし）は、向きによらず最後
  return filtered.sort((a, b) => {
    const ta = isCreated(glyphs, a) ? Date.parse(glyphs[a]!.updatedAt) : NaN;
    const tb = isCreated(glyphs, b) ? Date.parse(glyphs[b]!.updatedAt) : NaN;
    const na = Number.isNaN(ta);
    const nb = Number.isNaN(tb);
    if (na || nb) return na === nb ? tieBreak(a, b) : na ? 1 : -1;
    return dir * (ta - tb) || tieBreak(a, b);
  });
}

/** 絞り込み（検索・状態・種類）をしているか */
export const isFiltered = (o: QueueViewOptions) =>
  o.query.trim() !== "" || o.status !== "all" || o.kind !== "all";
