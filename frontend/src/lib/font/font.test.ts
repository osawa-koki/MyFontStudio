import * as opentypeNs from "opentype.js";
import { describe, expect, it } from "vitest";
import { glyphToOutline } from "../glyph/outline";
import type { Contour } from "../glyph/types";
import { createEmptyProject } from "../project/project";
import { JUU, KUCHI, LATIN_A, MARU, dot, makeGlyph } from "../testing/fixtures";
import { buildFont, collectOutlines } from "./build";
import { buildFontGlyphs, glyphName, notdefContours, NOTDEF_BOX } from "./glyphs";
import { contoursToPath } from "./otf";
import {
  CODE_PAGE_RANGE1,
  HEAD_FLAGS,
  LOWEST_REC_PPEM,
  buildName,
  buildOS2,
  buildSfnt,
  parseSfnt,
  tableChecksum,
  unicodeRanges,
} from "./sfnt";
import { createFontSpec, versionFromExportCount } from "./spec";
import { hheaExtents } from "./ttf";
import { signedArea } from "../glyph/geometry";
import { contoursBounds } from "../glyph/width";

// テストは Node で動くので、UMD の default を使う
const opentype = ("parse" in opentypeNs
  ? opentypeNs
  : (opentypeNs as unknown as { default: typeof opentypeNs }).default) as unknown as {
  parse(buf: ArrayBuffer): {
    numGlyphs: number;
    names: Record<string, Record<string, string>>;
    tables: Record<string, Record<string, number>>;
    charToGlyph(c: string): {
      name: string;
      advanceWidth: number;
      unicode: number;
      getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
      path: { commands: { type: string; x?: number; y?: number }[] };
    };
    glyphs: { get(i: number): { name: string; advanceWidth: number } };
  };
};

const FONT = {
  familyName: "TestHand",
  familyNameJa: "テスト手書き",
  designer: "大澤",
  exportCount: 3,
};
const NOW = new Date("2026-11-08T03:00:00Z");
const OUTLINES = [KUCHI, JUU, MARU, LATIN_A, makeGlyph("𠮷", [dot(500, 500)])].map(glyphToOutline);

const u32 = (b: ArrayBuffer, off: number) => new DataView(b).getUint32(off);
const os2 = (b: ArrayBuffer) => new DataView(parseSfnt(b).tables.get("OS/2")!.buffer);

describe("spec", () => {
  it("バージョンは 1 + 回数/1000 を小数 3 桁で書く", () => {
    expect(versionFromExportCount(0)).toBe(1);
    expect(versionFromExportCount(3)).toBe(1.003);
    expect(versionFromExportCount(10)).toBeGreaterThan(versionFromExportCount(9));
    expect(versionFromExportCount(-1)).toBe(1);
    expect(createFontSpec(FONT, NOW)).toMatchObject({
      version: 1.003,
      versionString: "Version 1.003",
      postScriptName: "TestHand-Regular",
      uniqueId: "TestHand-2026-11-08T03:00:00.000Z",
    });
    expect(createFontSpec({ ...FONT, exportCount: 1234 }).versionString).toBe("Version 2.234");
  });
});

describe("glyphs", () => {
  it("グリフ名", () => {
    expect(glyphName(0x41)).toBe("uni0041");
    expect(glyphName(0x3042)).toBe("uni3042");
    expect(glyphName(0x20bb7)).toBe("u20BB7");
  });
  it(".notdef は枠の中に×。外側は時計回り", () => {
    const c = notdefContours();
    expect(c.length).toBeGreaterThanOrEqual(2);
    const area = (k: Contour) => signedArea(k.map((p) => [p.x, p.y]));
    const sorted = c.slice().sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
    expect(area(sorted[0]!)).toBeLessThan(0);
    for (const k of c) {
      for (const p of k) {
        expect(p.x).toBeGreaterThanOrEqual(NOTDEF_BOX.x0);
        expect(p.x).toBeLessThanOrEqual(NOTDEF_BOX.x1);
      }
    }
  });
  it(".notdef・スペース・全角スペースを先頭に入れ、手書きはコードポイント順。輪郭のないものとスペースは除く", () => {
    const empty = { char: "x", unicode: 0x78, contours: [], advanceWidth: 250 };
    const space = { ...OUTLINES[0]!, char: " ", unicode: 0x20 };
    const g = buildFontGlyphs([...OUTLINES, empty, space]);
    expect(g.map((x) => x.name)).toEqual([
      ".notdef",
      "space",
      "uni3000",
      "uni0041",
      "uni3002",
      "uni5341",
      "uni53E3",
      "u20BB7",
    ]);
    expect(g[1]!.advanceWidth).toBe(300);
    expect(g[2]!.advanceWidth).toBe(1000);
  });
});

describe("sfnt", () => {
  it("unicodeRanges：含まれる文字のビットを立てる", () => {
    const r = unicodeRanges([0x41, 0x3002, 0x3042, 0x30a2, 0x6f22, 0x20bb7, 0xff21]);
    expect(r[0] & 1).toBe(1); // Basic Latin
    expect((r[1] >>> (48 - 32)) & 1).toBe(1); // CJK Symbols
    expect((r[1] >>> (49 - 32)) & 1).toBe(1); // Hiragana
    expect((r[1] >>> (50 - 32)) & 1).toBe(1); // Katakana
    expect((r[1] >>> (57 - 32)) & 1).toBe(1); // Non-Plane 0
    expect((r[1] >>> (59 - 32)) & 1).toBe(1); // CJK
    expect((r[2] >>> (68 - 64)) & 1).toBe(1); // Halfwidth and Fullwidth Forms
  });

  it("buildName：日本語名は 0x0411 で入れ、Mac には ASCII のものだけ入れる", () => {
    const parse = (data: Uint8Array) => {
      const v = new DataView(data.buffer);
      const count = v.getUint16(2);
      return Array.from({ length: count }, (_, i) => ({
        platform: v.getUint16(6 + i * 12),
        lang: v.getUint16(6 + i * 12 + 4),
        nameId: v.getUint16(6 + i * 12 + 6),
      }));
    };
    const withJa = parse(buildName(createFontSpec(FONT, NOW)));
    expect(withJa.filter((r) => r.lang === 0x411).map((r) => r.nameId)).toEqual([1, 2, 4]);
    // 作者「大澤」は ASCII でないので Mac には入れない
    expect(withJa.filter((r) => r.platform === 1).map((r) => r.nameId)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(withJa.filter((r) => r.platform === 3 && r.lang === 0x409).map((r) => r.nameId)).toEqual(
      [1, 2, 3, 4, 5, 6, 9],
    );
    const noJa = parse(buildName(createFontSpec({ ...FONT, familyNameJa: "", designer: "" }, NOW)));
    expect(noJa.some((r) => r.lang === 0x411 || r.nameId === 9)).toBe(false);
  });

  it("buildOS2：仕様 6.1・6.4 の値", () => {
    const v = new DataView(buildOS2(buildFontGlyphs(OUTLINES)).buffer);
    expect(v.getUint16(0)).toBe(4);
    expect(v.getUint16(4)).toBe(400);
    expect(v.getUint16(8)).toBe(0); // fsType
    expect(v.getUint16(62)).toBe(0x40);
    expect(v.getUint16(64)).toBe(0x20);
    expect(v.getUint16(66)).toBe(0xffff);
    expect([v.getInt16(68), v.getInt16(70), v.getInt16(72)]).toEqual([880, -120, 0]);
    expect([v.getUint16(74), v.getUint16(76)]).toEqual([1000, 200]);
    expect(v.getUint32(78)).toBe(CODE_PAGE_RANGE1);
    expect([v.getInt16(86), v.getInt16(88)]).toEqual([500, 700]);
    const empty = new DataView(buildOS2([]).buffer);
    expect([empty.getInt16(2), empty.getUint16(64), empty.getUint16(66)]).toEqual([0, 0, 0]);
  });

  it("parseSfnt → buildSfnt で中身を保ち、チェックサムを計算し直す", () => {
    const ttf = buildFont("ttf", OUTLINES, FONT, NOW)!;
    const sfnt = parseSfnt(ttf);
    const rebuilt = buildSfnt(sfnt);
    const again = parseSfnt(rebuilt).tables;
    expect([...again.keys()].sort()).toEqual([...sfnt.tables.keys()].sort());
    for (const [tag, data] of sfnt.tables) {
      // head は checkSumAdjustment（8〜11 バイト目）だけが変わる
      if (tag === "head") expect(again.get(tag)!.slice(12)).toEqual(data.slice(12));
      else expect(again.get(tag), tag).toEqual(data);
    }
    // フォント全体のチェックサムは 0xB1B0AFBA になる
    expect(tableChecksum(new Uint8Array(rebuilt))).toBe(0xb1b0afba);
    expect(tableChecksum(new Uint8Array(ttf))).toBe(0xb1b0afba);
    // 各テーブルのチェックサム
    const view = new DataView(rebuilt);
    for (let i = 0; i < view.getUint16(4); i++) {
      const rec = 12 + i * 16;
      const offset = view.getUint32(rec + 8);
      const length = view.getUint32(rec + 12);
      const data = new Uint8Array(rebuilt.slice(offset, offset + length));
      const tag = String.fromCharCode(...new Uint8Array(rebuilt.slice(rec, rec + 4)));
      if (tag === "head") new DataView(data.buffer).setUint32(8, 0);
      expect(view.getUint32(rec + 4), tag).toBe(tableChecksum(data));
    }
  });

  it("壊れたテーブルの記録は例外", () => {
    const buf = new ArrayBuffer(28);
    const v = new DataView(buf);
    v.setUint32(0, 0x10000);
    v.setUint16(4, 1);
    v.setUint32(12 + 8, 100);
    v.setUint32(12 + 12, 100);
    expect(() => parseSfnt(buf)).toThrow();
  });
});

describe("buildFont（.ttf と .otf）", () => {
  const ttf = buildFont("ttf", OUTLINES, FONT, NOW)!;
  const otf = buildFont("otf", OUTLINES, FONT, NOW)!;

  it("形式：.ttf は TrueType（glyf）、.otf は CFF", () => {
    expect(u32(ttf, 0)).toBe(0x00010000);
    expect(u32(otf, 0)).toBe(0x4f54544f); // 'OTTO'
    expect(parseSfnt(ttf).tables.has("glyf")).toBe(true);
    expect(parseSfnt(otf).tables.has("CFF ")).toBe(true);
  });

  it("両形式で name・OS/2・hhea・head の値が同じ", () => {
    for (const tag of ["name", "OS/2"]) {
      expect(parseSfnt(ttf).tables.get(tag), tag).toEqual(parseSfnt(otf).tables.get(tag));
    }
    for (const b of [ttf, otf]) {
      const t = parseSfnt(b).tables;
      const hhea = new DataView(t.get("hhea")!.buffer);
      expect([hhea.getInt16(4), hhea.getInt16(6), hhea.getInt16(8)]).toEqual([1000, -200, 0]);
      const head = new DataView(t.get("head")!.buffer);
      expect(head.getUint16(18)).toBe(1000); // unitsPerEm
      expect(head.getInt32(4) / 65536).toBeCloseTo(1.003, 4); // fontRevision（Fixed 16.16）
      expect(os2(b).getUint16(8)).toBe(0);
    }
  });

  it("両形式で送り幅・輪郭の範囲・cmap が一致する", () => {
    const ft = opentype.parse(ttf);
    const fo = opentype.parse(otf);
    expect(ft.numGlyphs).toBe(fo.numGlyphs);
    expect(JSON.stringify(ft.names)).toContain("TestHand");
    for (const o of OUTLINES) {
      const gt = ft.charToGlyph(o.char);
      const go = fo.charToGlyph(o.char);
      expect(gt.unicode, o.char).toBe(o.unicode);
      expect(go.unicode, o.char).toBe(o.unicode);
      expect(gt.advanceWidth).toBe(o.advanceWidth);
      expect(go.advanceWidth).toBe(o.advanceWidth);
      const bt = gt.getBoundingBox();
      const bo = go.getBoundingBox();
      for (const k of ["x1", "y1", "x2", "y2"] as const)
        expect(Math.abs(bt[k] - bo[k])).toBeLessThanOrEqual(1);
    }
  });

  it("両形式で hmtx の lsb は各グリフの輪郭の xMin、head の flags・lowestRecPPEM も同じ", () => {
    const glyphs = buildFontGlyphs(OUTLINES);
    const expected = glyphs.map((g) => contoursBounds(g.contours)?.xMin ?? 0);
    for (const buffer of [ttf, otf]) {
      const t = parseSfnt(buffer).tables;
      const hhea = new DataView(t.get("hhea")!.buffer);
      const hmtx = new DataView(t.get("hmtx")!.buffer);
      const n = hhea.getUint16(34);
      const lsb = glyphs.map((_, i) => hmtx.getInt16(i < n ? i * 4 + 2 : n * 4 + (i - n) * 2));
      expect(lsb).toEqual(expected);
      const head = new DataView(t.get("head")!.buffer);
      expect(head.getUint16(16)).toBe(HEAD_FLAGS);
      expect(head.getUint16(46)).toBe(LOWEST_REC_PPEM);
    }
    expect(expected[0]).toBe(NOTDEF_BOX.x0);
  });

  it(".ttf の輪郭は中間データの点そのまま", () => {
    const ft = opentype.parse(ttf);
    const g = ft.charToGlyph("口") as unknown as {
      points: { x: number; y: number; onCurve: boolean }[];
    };
    const expected = OUTLINES[0]!.contours.flat().map(({ x, y, onCurve }) => ({ x, y, onCurve }));
    expect(g.points.map(({ x, y, onCurve }) => ({ x, y, onCurve }))).toEqual(expected);
  });

  it(".otf の輪郭は向きを反転し、onCurve の点は同じ座標", () => {
    const contours = OUTLINES[0]!.contours;
    const path = contoursToPath(contours);
    const key = (x?: number, y?: number) => `${x},${y}`;
    const ends = new Set(path.commands.filter((c) => c.type !== "Z").map((c) => key(c.x, c.y)));
    const onCurve = new Set(
      contours
        .flat()
        .filter((p) => p.onCurve)
        .map((p) => key(p.x, p.y)),
    );
    // offCurve が連続しない輪郭なので、各区間の終点は onCurve の点と一致する
    expect(ends).toEqual(onCurve);
    // 向きは反転する（y 上向きで反時計回り＝正）
    const first = path.commands.slice(
      0,
      path.commands.findIndex((c) => c.type === "Z"),
    );
    const area = signedArea(first.map((c) => [c.x!, c.y!]));
    expect(Math.sign(area)).toBe(-Math.sign(signedArea(contours[0]!.map((p) => [p.x, p.y]))));
  });

  it("輪郭のあるグリフがなければ作らない", () => {
    expect(buildFont("ttf", [], FONT)).toBeNull();
  });

  it("hheaExtents は輪郭のあるグリフだけで計算する", () => {
    expect(hheaExtents(buildFontGlyphs([]).slice(1))).toEqual({});
    const e = hheaExtents(buildFontGlyphs(OUTLINES));
    expect(e.minLeftSideBearing).toBe(60);
  });
});

describe("contoursToPath", () => {
  it("offCurve が続くときは中点を補い、直線は lineTo", () => {
    const path = contoursToPath([
      [
        { x: 0, y: 0, onCurve: true },
        { x: 0, y: 10, onCurve: true },
        { x: 10, y: 10, onCurve: false },
        { x: 10, y: 0, onCurve: false },
      ],
      [],
    ]);
    expect(path.commands.map((c) => c.type)).toEqual(["M", "Q", "Q", "Z"]);
    const lines = contoursToPath([
      [
        { x: 0, y: 0, onCurve: true },
        { x: 10, y: 0, onCurve: true },
        { x: 10, y: 10, onCurve: true },
      ],
    ]);
    expect(lines.commands.map((c) => [c.type, c.x, c.y])).toEqual([
      ["M", 0, 0],
      ["L", 10, 10],
      ["L", 10, 0],
      ["Z", undefined, undefined],
    ]);
  });
});

describe("collectOutlines", () => {
  it("一覧の順で、作成済み・輪郭のあるグリフだけを集める", () => {
    const p = createEmptyProject();
    p.queue = ["十", "未", "口"];
    p.glyphs = {
      口: KUCHI,
      十: JUU,
      空: makeGlyph("空", []),
      外: makeGlyph("外", [dot(500, 500)]),
    };
    expect(collectOutlines(p).map((o) => o.char)).toEqual(["十", "口", "外"]);
  });
});
