import * as opentypeNs from "opentype.js";
import { describe, expect, it } from "vitest";
import { glyphToOutline } from "../glyph/outline";
import { JUU, KUCHI, LATIN_A, MARU } from "../testing/fixtures";
import { buildFont } from "./build";
import { encodeDict, parseDict, setCffFontBBox } from "./cff";
import { buildFontGlyphs } from "./glyphs";
import { buildOtf } from "./otf";
import { fontExtents, parseSfnt } from "./sfnt";
import { createFontSpec } from "./spec";

const opentype = ("parse" in opentypeNs
  ? opentypeNs
  : (opentypeNs as unknown as { default: typeof opentypeNs }).default) as unknown as {
  parse(buf: ArrayBuffer): {
    charToGlyph(c: string): { path: { commands: unknown[] } };
    tables: { cff: { topDict: { fontBBox: number[] } } };
  };
};

const OUTLINES = [KUCHI, JUU, MARU, LATIN_A].map(glyphToOutline);
const FONT = { familyName: "T", familyNameJa: "", designer: "", exportCount: 0 };

/** CFF テーブルの Top DICT を読む */
function topDict(cff: Uint8Array) {
  const hdr = cff[2]!;
  const readIndexEnd = (pos: number) => {
    const count = (cff[pos]! << 8) | cff[pos + 1]!;
    const offSize = cff[pos + 2]!;
    const off = (i: number) => {
      let o = 0;
      for (let k = 0; k < offSize; k++) o = o * 256 + cff[pos + 3 + i * offSize + k]!;
      return o;
    };
    const start = pos + 3 + (count + 1) * offSize - 1;
    return { start: start + off(0), end: start + off(count) };
  };
  const name = readIndexEnd(hdr);
  const top = readIndexEnd(name.end);
  return parseDict(cff.slice(top.start, top.end));
}

describe("CFF の DICT", () => {
  it("整数・実数・2 バイトの演算子を読み書きできる", () => {
    const entries = [
      { op: 5, operands: [-40, 0, 1000, 70000] },
      { op: 1207, operands: [0.001, 0, 0, 0.001, 0, 0] },
      { op: 18, operands: [45, 1234] },
    ];
    expect(parseDict(encodeDict(entries))).toEqual(entries);
    // 1 バイト・2 バイト・3 バイトの整数
    expect(parseDict(Uint8Array.from([139, 247, 0, 251, 0, 28, 0x7f, 0xff, 5]))).toEqual([
      { op: 5, operands: [0, 108, -108, 32767] },
    ]);
    expect(() => parseDict(Uint8Array.from([255]))).toThrow();
  });
});

describe("setCffFontBBox", () => {
  it("FontBBox を書き換え、グリフの形は変えない", () => {
    const spec = createFontSpec(FONT);
    const glyphs = buildFontGlyphs(OUTLINES);
    const otf = buildOtf(spec, glyphs);
    const cff = parseSfnt(otf).tables.get("CFF ")!;
    const ext = fontExtents(glyphs);
    expect(topDict(cff).find((e) => e.op === 5)!.operands).toEqual([
      ext.xMin,
      ext.yMin,
      ext.xMax,
      ext.yMax,
    ]);
    // 書き換えたあとも opentype.js で読め、同じ形
    const again = setCffFontBBox(cff, { xMin: -1, yMin: -2, xMax: 3000, yMax: 4000 });
    expect(topDict(again).find((e) => e.op === 5)!.operands).toEqual([-1, -2, 3000, 4000]);
    const parsed = opentype.parse(otf);
    expect(parsed.tables.cff.topDict.fontBBox).toEqual([ext.xMin, ext.yMin, ext.xMax, ext.yMax]);
    expect(parsed.charToGlyph("口").path.commands.length).toBeGreaterThan(0);
  });

  it("両形式で head・hhea の範囲を輪郭から計算した値にする", () => {
    const glyphs = buildFontGlyphs(OUTLINES);
    const ext = fontExtents(glyphs);
    for (const format of ["ttf", "otf"] as const) {
      const t = parseSfnt(buildFont(format, OUTLINES, FONT)!).tables;
      const head = new DataView(t.get("head")!.buffer);
      expect([head.getInt16(36), head.getInt16(38), head.getInt16(40), head.getInt16(42)]).toEqual([
        ext.xMin,
        ext.yMin,
        ext.xMax,
        ext.yMax,
      ]);
      const hhea = new DataView(t.get("hhea")!.buffer);
      expect([hhea.getUint16(10), hhea.getInt16(12), hhea.getInt16(14), hhea.getInt16(16)]).toEqual(
        [ext.advanceWidthMax, ext.minLeftSideBearing, ext.minRightSideBearing, ext.xMaxExtent],
      );
    }
    // .notdef（下は -40）も範囲に入る
    expect(ext.yMin).toBeLessThanOrEqual(-40);
  });

  it("輪郭のないグリフだけなら範囲は 0", () => {
    expect(
      fontExtents([{ name: "space", unicode: 32, advanceWidth: 300, contours: [] }]),
    ).toMatchObject({
      xMin: 0,
      yMax: 0,
      advanceWidthMax: 300,
    });
  });
});
