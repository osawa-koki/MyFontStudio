import { describe, expect, it } from "vitest";
import { collectOutlines } from "../lib/font/outlines";
import { glyphToOutline } from "../lib/glyph/outline";
import type { Contour } from "../lib/glyph/types";
import { createEmptyProject } from "../lib/project/project";
import { JUU, KUCHI, makeGlyph } from "../lib/testing/fixtures";
import { readZipEntries } from "../lib/archive/zipinfo";
import { runTask, type Progress } from "./tasks";

const toBuffer = (u8: Uint8Array) =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

function project() {
  const p = createEmptyProject("Task");
  p.queue = ["十", "口", "空"];
  p.glyphs = { 口: KUCHI, 十: JUU, 空: makeGlyph("空", []) };
  return p;
}

describe("runTask", () => {
  it("buildFont：フォントを作る（輪郭がなければ null）", async () => {
    const font = project().font;
    const ttf = await runTask({
      kind: "buildFont",
      format: "ttf",
      outlines: [glyphToOutline(KUCHI)],
      font,
    });
    expect(ttf).toBeInstanceOf(ArrayBuffer);
    expect(await runTask({ kind: "buildFont", format: "otf", outlines: [], font })).toBeNull();
  });

  it("saveZip：フォント・PNG・圧縮の順に進み具合を知らせ、zip を作る。書き出し回数を入れる", async () => {
    const progress: Progress[] = [];
    const drawn: (readonly Contour[])[] = [];
    const p = project();
    const zip = await runTask(
      {
        kind: "saveZip",
        project: p,
        outlines: collectOutlines(p),
        savedAt: "2026-11-08T00:00:00+09:00",
        exportCount: 7,
        withPreviews: true,
      },
      {
        onProgress: (x) => progress.push(x),
        renderPng: async (contours) => {
          drawn.push(contours);
          return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        },
      },
    );
    // PNG は作成済みのグリフ（一覧の順）を、渡した輪郭から描く
    expect(drawn).toEqual([glyphToOutline(JUU).contours, glyphToOutline(KUCHI).contours]);
    expect(progress.map((x) => x.label)).toEqual(
      expect.arrayContaining([
        "フォントを作っています",
        "プレビュー画像を作っています",
        "圧縮しています",
      ]),
    );
    const names = readZipEntries(toBuffer(zip)).map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "fontfile/Task.ttf",
        "fontfile/Task.otf",
        "rawdata/preview/U+53E3.png",
      ]),
    );

    // readZip で読み戻せ、ベクター JSON から作り直した輪郭は、渡した輪郭と同じ（同じ入力から同じ結果）
    const read = await runTask({ kind: "readZip", buffer: toBuffer(zip) });
    expect(read.project.font.exportCount).toBe(7);
    expect(Object.keys(read.project.glyphs).sort()).toEqual(["十", "口"].sort());
    expect(collectOutlines(read.project)).toEqual(collectOutlines(p));
  });

  it("saveZip：輪郭は計算し直さず、渡されたものを使う", async () => {
    const p = project();
    const zip = await runTask({
      kind: "saveZip",
      project: p,
      outlines: [],
      savedAt: "",
      exportCount: 1,
      withPreviews: false,
    });
    // 輪郭を渡さなければ、グリフがあってもフォントは入らない
    expect(readZipEntries(toBuffer(zip)).some((e) => e.name.startsWith("fontfile/"))).toBe(false);
  });

  it("saveZip：PNG を描けない環境・グリフがないときは、PNG・フォントなしの zip", async () => {
    const p = createEmptyProject();
    p.queue = ["あ"];
    const zip = await runTask({
      kind: "saveZip",
      project: p,
      outlines: [],
      savedAt: "",
      exportCount: 1,
      withPreviews: true,
    });
    expect(readZipEntries(toBuffer(zip)).map((e) => e.name)).toEqual(["project.json"]);
  });
});
