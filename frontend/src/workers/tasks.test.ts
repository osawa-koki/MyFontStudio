import { describe, expect, it } from "vitest";
import { glyphToOutline } from "../lib/glyph/outline";
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

  it("saveZip：輪郭・フォント・PNG・圧縮の順に進み具合を知らせ、zip を作る。書き出し回数を入れる", async () => {
    const progress: Progress[] = [];
    let pngs = 0;
    const zip = await runTask(
      {
        kind: "saveZip",
        project: project(),
        savedAt: "2026-11-08T00:00:00+09:00",
        exportCount: 7,
        withPreviews: true,
      },
      {
        onProgress: (p) => progress.push(p),
        renderPng: async () => {
          pngs++;
          return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        },
      },
    );
    expect(pngs).toBe(2);
    expect(progress.map((p) => p.label)).toEqual(
      expect.arrayContaining([
        "輪郭を計算しています",
        "フォントを作っています",
        "プレビュー画像を作っています",
        "圧縮しています",
      ]),
    );
    const outline = progress.filter((p) => p.label === "輪郭を計算しています");
    expect(outline[outline.length - 1]).toMatchObject({ done: 2, total: 2 });
    const names = readZipEntries(toBuffer(zip)).map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "fontfile/Task.ttf",
        "fontfile/Task.otf",
        "rawdata/preview/U+53E3.png",
      ]),
    );

    // readZip で読み戻せる
    const read = await runTask({ kind: "readZip", buffer: toBuffer(zip) });
    expect(read.project.font.exportCount).toBe(7);
    expect(Object.keys(read.project.glyphs).sort()).toEqual(["十", "口"].sort());
  });

  it("saveZip：PNG を描けない環境・グリフがないときは、PNG・フォントなしの zip", async () => {
    const p = createEmptyProject();
    p.queue = ["あ"];
    const zip = await runTask({
      kind: "saveZip",
      project: p,
      savedAt: "",
      exportCount: 1,
      withPreviews: true,
    });
    expect(readZipEntries(toBuffer(zip)).map((e) => e.name)).toEqual(["project.json"]);
  });
});
