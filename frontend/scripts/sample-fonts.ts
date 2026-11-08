// テスト用の固定のストロークから .ttf と .otf を書き出す（fontTools・OTS で中身を確かめるため）。
// 使い方：npm run fonts:sample → out/Sample.ttf・out/Sample.otf
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glyphToOutline } from "../src/lib/glyph/outline";
import { buildFont } from "../src/lib/font/build";
import { JUU, KUCHI, LATIN_A, MARU, line, makeGlyph } from "../src/lib/testing/fixtures";

const outDir = join(import.meta.dirname, "..", "out");
mkdirSync(outDir, { recursive: true });

const glyphs = [
  KUCHI,
  JUU,
  MARU,
  LATIN_A,
  makeGlyph("あ", [line(300, 300, 700, 300), line(500, 150, 520, 800), line(650, 450, 300, 800)]),
  makeGlyph("𠮷", [line(200, 200, 800, 200), line(500, 100, 500, 500), line(250, 500, 750, 500)]),
];
const outlines = glyphs.map(glyphToOutline);
const font = {
  familyName: "Sample",
  familyNameJa: "サンプル手書き",
  designer: "Tester",
  exportCount: 3,
};
const now = new Date("2026-11-08T12:00:00Z");
for (const format of ["ttf", "otf"] as const) {
  const buf = buildFont(format, outlines, font, now)!;
  writeFileSync(join(outDir, `Sample.${format}`), new Uint8Array(buf));
  console.log(`out/Sample.${format}: ${buf.byteLength} bytes`);
}
