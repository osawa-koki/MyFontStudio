// sfnt（TrueType / OpenType）のバイナリを読み書きする最小限の処理。
// ライブラリで書き出したフォントのテーブルを差し替え・書き換えて、両形式で名前・メトリクス・OS/2 の値をそろえる（仕様 6.4）
import type { FontGlyph } from "./glyphs";
import {
  CAP_HEIGHT,
  FS_SELECTION_REGULAR,
  HHEA_ASCENDER,
  HHEA_DESCENDER,
  HHEA_LINE_GAP,
  TYPO_ASCENDER,
  TYPO_DESCENDER,
  TYPO_LINE_GAP,
  UNDERLINE_POSITION,
  UNDERLINE_THICKNESS,
  VENDOR_ID,
  WEIGHT_CLASS,
  WIN_ASCENT,
  WIN_DESCENT,
  X_HEIGHT,
} from "./metrics";
import type { FontSpec } from "./spec";

export interface Sfnt {
  /** 0x00010000（TrueType）または 'OTTO'（CFF） */
  sfntVersion: number;
  tables: Map<string, Uint8Array>;
}

const tagOf = (view: DataView, offset: number) =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

export function parseSfnt(buffer: ArrayBuffer): Sfnt {
  const view = new DataView(buffer);
  const sfntVersion = view.getUint32(0);
  const numTables = view.getUint16(4);
  const tables = new Map<string, Uint8Array>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = tagOf(view, rec);
    const offset = view.getUint32(rec + 8);
    const length = view.getUint32(rec + 12);
    if (offset + length > buffer.byteLength) throw new Error(`テーブル ${tag} が壊れている`);
    tables.set(tag, new Uint8Array(buffer.slice(offset, offset + length)));
  }
  return { sfntVersion, tables };
}

export function tableChecksum(data: Uint8Array): number {
  let sum = 0;
  const padded = Math.ceil(data.length / 4) * 4;
  for (let i = 0; i < padded; i += 4) {
    const word =
      ((data[i] ?? 0) << 24) |
      ((data[i + 1] ?? 0) << 16) |
      ((data[i + 2] ?? 0) << 8) |
      (data[i + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

/** テーブルを並べ直して sfnt を組み立てる。チェックサムと head.checkSumAdjustment を計算し直す */
export function buildSfnt(sfnt: Sfnt): ArrayBuffer {
  const tags = [...sfnt.tables.keys()].sort();
  const numTables = tags.length;
  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= numTables) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;
  const headerSize = 12 + numTables * 16;
  let size = headerSize;
  for (const tag of tags) size += Math.ceil(sfnt.tables.get(tag)!.length / 4) * 4;

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, sfnt.sfntVersion);
  view.setUint16(4, numTables);
  view.setUint16(6, searchRange);
  view.setUint16(8, entrySelector);
  view.setUint16(10, numTables * 16 - searchRange);

  let offset = headerSize;
  let headOffset = -1;
  tags.forEach((tag, i) => {
    const data = sfnt.tables.get(tag)!.slice();
    if (tag === "head") {
      new DataView(data.buffer).setUint32(8, 0);
      headOffset = offset;
    }
    const rec = 12 + i * 16;
    for (let k = 0; k < 4; k++) view.setUint8(rec + k, tag.charCodeAt(k));
    view.setUint32(rec + 4, tableChecksum(data));
    view.setUint32(rec + 8, offset);
    view.setUint32(rec + 12, data.length);
    out.set(data, offset);
    offset += Math.ceil(data.length / 4) * 4;
  });
  if (headOffset >= 0) {
    view.setUint32(headOffset + 8, (0xb1b0afba - tableChecksum(out)) >>> 0);
  }
  return out.buffer;
}

// ---- テーブルを作る・書き換える ----

/** Unicode の範囲と OS/2 ulUnicodeRange のビット（使いそうなものだけ） */
const UNICODE_RANGES: [start: number, end: number, bit: number][] = [
  [0x0000, 0x007f, 0],
  [0x0080, 0x00ff, 1],
  [0x0100, 0x017f, 2],
  [0x0180, 0x024f, 3],
  [0x0370, 0x03ff, 7],
  [0x0400, 0x04ff, 9],
  [0x2000, 0x206f, 31],
  [0x20a0, 0x20cf, 33],
  [0x2100, 0x214f, 35],
  [0x2150, 0x218f, 36],
  [0x2190, 0x21ff, 37],
  [0x2200, 0x22ff, 38],
  [0x2460, 0x24ff, 42],
  [0x2500, 0x257f, 43],
  [0x2580, 0x259f, 44],
  [0x25a0, 0x25ff, 45],
  [0x2600, 0x26ff, 46],
  [0x2700, 0x27bf, 47],
  [0x2e80, 0x2fdf, 59],
  [0x3000, 0x303f, 48],
  [0x3040, 0x309f, 49],
  [0x30a0, 0x30ff, 50],
  [0x31c0, 0x31ef, 61],
  [0x31f0, 0x31ff, 50],
  [0x3200, 0x32ff, 54],
  [0x3300, 0x33ff, 55],
  [0x3400, 0x4dbf, 59],
  [0x4e00, 0x9fff, 59],
  [0xf900, 0xfaff, 61],
  [0xff00, 0xffef, 68],
  [0x20000, 0x2fa1f, 59],
];

/** 含まれる文字から ulUnicodeRange1〜4 を計算する */
export function unicodeRanges(codepoints: Iterable<number>): [number, number, number, number] {
  const r: [number, number, number, number] = [0, 0, 0, 0];
  const set = (bit: number) => {
    r[bit >> 5] = (r[bit >> 5]! | (1 << (bit & 31))) >>> 0;
  };
  for (const cp of codepoints) {
    if (cp > 0xffff) set(57); // Non-Plane 0
    for (const [start, end, bit] of UNICODE_RANGES) {
      if (cp >= start && cp <= end) set(bit);
    }
  }
  return r;
}

/** Latin 1（bit 0）と JIS（bit 17） */
export const CODE_PAGE_RANGE1 = (1 << 0) | (1 << 17);

/** OS/2 テーブル（version 4、96 バイト）を作る */
export function buildOS2(glyphs: readonly FontGlyph[]): Uint8Array {
  const data = new Uint8Array(96);
  const v = new DataView(data.buffer);
  const widths = glyphs.map((g) => g.advanceWidth).filter((w) => w > 0);
  const avg = widths.length ? Math.round(widths.reduce((a, b) => a + b, 0) / widths.length) : 0;
  const cps = glyphs.map((g) => g.unicode).filter((u): u is number => u !== null);
  const [r1, r2, r3, r4] = unicodeRanges(cps);
  v.setUint16(0, 4); // version
  v.setInt16(2, avg); // xAvgCharWidth
  v.setUint16(4, WEIGHT_CLASS);
  v.setUint16(6, 5); // usWidthClass: Medium (normal)
  v.setUint16(8, 0); // fsType: インストール可能
  v.setInt16(10, 650); // ySubscriptXSize
  v.setInt16(12, 600); // ySubscriptYSize
  v.setInt16(14, 0); // ySubscriptXOffset
  v.setInt16(16, 75); // ySubscriptYOffset
  v.setInt16(18, 650); // ySuperscriptXSize
  v.setInt16(20, 600); // ySuperscriptYSize
  v.setInt16(22, 0); // ySuperscriptXOffset
  v.setInt16(24, 350); // ySuperscriptYOffset
  v.setInt16(26, 50); // yStrikeoutSize
  v.setInt16(28, 300); // yStrikeoutPosition
  v.setInt16(30, 0); // sFamilyClass
  // panose（32〜41）はすべて 0（Any）
  v.setUint32(42, r1);
  v.setUint32(46, r2);
  v.setUint32(50, r3);
  v.setUint32(54, r4);
  for (let i = 0; i < 4; i++) v.setUint8(58 + i, VENDOR_ID.charCodeAt(i));
  v.setUint16(62, FS_SELECTION_REGULAR);
  v.setUint16(64, cps.length ? Math.min(0xffff, Math.min(...cps)) : 0); // usFirstCharIndex
  v.setUint16(66, cps.length ? Math.min(0xffff, Math.max(...cps)) : 0); // usLastCharIndex
  v.setInt16(68, TYPO_ASCENDER);
  v.setInt16(70, TYPO_DESCENDER);
  v.setInt16(72, TYPO_LINE_GAP);
  v.setUint16(74, WIN_ASCENT);
  v.setUint16(76, WIN_DESCENT);
  v.setUint32(78, CODE_PAGE_RANGE1);
  v.setUint32(82, 0);
  v.setInt16(86, X_HEIGHT);
  v.setInt16(88, CAP_HEIGHT);
  v.setUint16(90, 0); // usDefaultChar
  v.setUint16(92, 0x20); // usBreakChar
  v.setUint16(94, 0); // usMaxContext（GSUB・GPOS なし）
  return data;
}

interface NameRecord {
  platformId: number;
  encodingId: number;
  languageId: number;
  nameId: number;
  bytes: Uint8Array;
}

const utf16be = (s: string) => {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    out[i * 2] = s.charCodeAt(i) >> 8;
    out[i * 2 + 1] = s.charCodeAt(i) & 0xff;
  }
  return out;
};
const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

export const LANG_EN_US = 0x0409;
export const LANG_JA_JP = 0x0411;

/**
 * name テーブル（format 0）を作る。
 * Windows（3, 1）の英語（0x0409）と、日本語名があれば日本語（0x0411）、Mac（1, 0, 0）の英語（ASCII のものだけ）
 */
export function buildName(spec: FontSpec): Uint8Array {
  const fullName = `${spec.familyName} ${spec.styleName}`;
  const english: [number, string][] = [
    [1, spec.familyName],
    [2, spec.styleName],
    [3, spec.uniqueId],
    [4, fullName],
    [5, spec.versionString],
    [6, spec.postScriptName],
  ];
  if (spec.designer) english.push([9, spec.designer]);

  const records: NameRecord[] = [];
  for (const [nameId, s] of english) {
    if (isAscii(s))
      records.push({ platformId: 1, encodingId: 0, languageId: 0, nameId, bytes: ascii(s) });
    records.push({
      platformId: 3,
      encodingId: 1,
      languageId: LANG_EN_US,
      nameId,
      bytes: utf16be(s),
    });
  }
  if (spec.familyNameJa) {
    const ja: [number, string][] = [
      [1, spec.familyNameJa],
      [2, spec.styleName],
      [4, `${spec.familyNameJa} ${spec.styleName}`],
    ];
    for (const [nameId, s] of ja) {
      records.push({
        platformId: 3,
        encodingId: 1,
        languageId: LANG_JA_JP,
        nameId,
        bytes: utf16be(s),
      });
    }
  }
  records.sort(
    (a, b) =>
      a.platformId - b.platformId ||
      a.encodingId - b.encodingId ||
      a.languageId - b.languageId ||
      a.nameId - b.nameId,
  );

  const stringOffset = 6 + records.length * 12;
  const stringsLength = records.reduce((n, r) => n + r.bytes.length, 0);
  const data = new Uint8Array(stringOffset + stringsLength);
  const v = new DataView(data.buffer);
  v.setUint16(0, 0);
  v.setUint16(2, records.length);
  v.setUint16(4, stringOffset);
  let offset = 0;
  records.forEach((r, i) => {
    const p = 6 + i * 12;
    v.setUint16(p, r.platformId);
    v.setUint16(p + 2, r.encodingId);
    v.setUint16(p + 4, r.languageId);
    v.setUint16(p + 6, r.nameId);
    v.setUint16(p + 8, r.bytes.length);
    v.setUint16(p + 10, offset);
    data.set(r.bytes, stringOffset + offset);
    offset += r.bytes.length;
  });
  return data;
}

/** 1904-01-01 からの秒（LONGDATETIME） */
function setLongDateTime(v: DataView, offset: number, date: Date): void {
  const seconds = Math.floor(date.getTime() / 1000) + 2082844800;
  v.setUint32(offset, Math.floor(seconds / 2 ** 32));
  v.setUint32(offset + 4, seconds >>> 0);
}

/**
 * ライブラリで書き出したフォントを仕上げる：name・OS/2 を差し替え、head・hhea・maxp・post の値を書き換える
 */
export function finalizeFont(
  buffer: ArrayBuffer,
  spec: FontSpec,
  glyphs: readonly FontGlyph[],
): ArrayBuffer {
  const sfnt = parseSfnt(buffer);
  const t = sfnt.tables;
  t.set("name", buildName(spec));
  t.set("OS/2", buildOS2(glyphs));

  const head = t.get("head");
  if (!head) throw new Error("head テーブルがない");
  const hv = new DataView(head.buffer);
  hv.setInt32(4, Math.round(spec.version * 65536)); // fontRevision（Fixed）
  setLongDateTime(hv, 20, spec.createdAt); // created
  setLongDateTime(hv, 28, spec.createdAt); // modified
  hv.setUint16(44, 0); // macStyle

  const hhea = t.get("hhea");
  if (!hhea) throw new Error("hhea テーブルがない");
  const hh = new DataView(hhea.buffer);
  hh.setInt16(4, HHEA_ASCENDER);
  hh.setInt16(6, HHEA_DESCENDER);
  hh.setInt16(8, HHEA_LINE_GAP);

  // TrueType の maxp（version 1.0）：maxZones は 1 以上（fonteditor-core は 0 を書く）
  const maxp = t.get("maxp");
  if (maxp && maxp.length >= 32) {
    const mv = new DataView(maxp.buffer);
    if (mv.getUint16(14) < 1) mv.setUint16(14, 2);
  }

  const post = t.get("post");
  if (post && post.length >= 32) {
    const pv = new DataView(post.buffer);
    pv.setInt16(8, UNDERLINE_POSITION);
    pv.setInt16(10, UNDERLINE_THICKNESS);
    pv.setUint32(12, 0); // isFixedPitch
  }
  return buildSfnt(sfnt);
}
