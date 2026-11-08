import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { Project } from "../../types/project";
import { createEmptyProject } from "../project/project";
import { addStroke, clearStrokes, createHistory, undo } from "../stroke/history";
import { JUU, KUCHI, LATIN_A, MARU, dot, makeGlyph } from "../testing/fixtures";
import packageJson from "../../../package.json";
import {
  APP_VERSION,
  ArchiveError,
  archiveFileName,
  buildArchive,
  readArchive,
  toProjectJson,
  vectorPath,
} from "./archive";
import { FORMAT_VERSION, migrations } from "./schema";
import { readZipEntries } from "./zipinfo";

const toBuffer = (u8: Uint8Array) =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

function sampleProject(): Project {
  const p = createEmptyProject("TestHand");
  p.font = {
    familyName: "TestHand",
    familyNameJa: "テスト手書き",
    designer: "大澤",
    exportCount: 3,
  };
  p.defaults = {
    pen: { size: 55, thinning: 0.4, smoothing: 0.6, streamline: 0.3 },
    usePressure: false,
    showModel: false,
  };
  p.queue = ["口", "未", "十", "。", "A", "𠮷"];
  p.previewText = "口十A。\n未作成";
  p.glyphs = { 口: KUCHI, 十: JUU, "。": MARU, A: LATIN_A, 空: makeGlyph("空", []) };
  return p;
}

async function zipOf(files: Record<string, string | Uint8Array>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data, { createFolders: false });
  return toBuffer(await zip.generateAsync({ type: "uint8array" }));
}

describe("APP_VERSION", () => {
  it("package.json の version と同じ", () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });
});

describe("archiveFileName", () => {
  it("{familyName}_{YYYYMMDD-HHmm}.zip", () => {
    expect(archiveFileName("MyHand", new Date(2026, 10, 7, 20, 5))).toBe(
      "MyHand_20261107-2005.zip",
    );
  });
});

describe("buildArchive / readArchive", () => {
  it("保存 → 読み込みで、未作成の文字を含む一覧・ストローク・設定・文章が復元される", async () => {
    const project = sampleProject();
    const zipped = await buildArchive({
      project,
      savedAt: "2026-11-08T12:00:00+09:00",
      ttf: new Uint8Array([1, 2, 3]).buffer,
      otf: new Uint8Array([4, 5]).buffer,
      previews: new Map([["口", new Uint8Array([0x89, 0x50, 0x4e, 0x47])]]),
    });
    const names = readZipEntries(toBuffer(zipped))
      .map((e) => e.name)
      .sort();
    expect(names).toEqual(
      [
        "project.json",
        "fontfile/TestHand.ttf",
        "fontfile/TestHand.otf",
        "rawdata/vector/U+53E3.json",
        "rawdata/vector/U+5341.json",
        "rawdata/vector/U+3002.json",
        "rawdata/vector/U+0041.json",
        "rawdata/preview/U+53E3.png",
      ].sort(),
    );
    const { project: restored, skipped } = await readArchive(toBuffer(zipped));
    expect(skipped).toEqual([]);
    expect(restored.font).toEqual(project.font);
    expect(restored.defaults).toEqual(project.defaults);
    expect(restored.previewText).toBe(project.previewText);
    expect(restored.queue).toEqual(project.queue);
    // ストロークのない「空」は保存しない
    expect(Object.keys(restored.glyphs).sort()).toEqual(["。", "A", "十", "口"].sort());
    expect(restored.glyphs["口"]).toEqual(KUCHI);
    expect(restored.glyphs["A"]).toEqual(LATIN_A);
  });

  it("グリフが 0 個ならフォントは入れない", async () => {
    const p = createEmptyProject();
    p.queue = ["あ"];
    const zipped = await buildArchive({
      project: p,
      savedAt: "",
      ttf: null,
      otf: null,
      previews: new Map(),
    });
    expect(readZipEntries(toBuffer(zipped)).map((e) => e.name)).toEqual(["project.json"]);
    const r = await readArchive(toBuffer(zipped));
    expect(r.project.queue).toEqual(["あ"]);
  });

  it("project.json の内容", () => {
    const json = toProjectJson(sampleProject(), "2026-11-08T12:00:00+09:00");
    expect(json).toMatchObject({
      format: "handwriting-font-project",
      formatVersion: 2,
      appVersion: "0.1.0",
    });
    expect(json.glyphs.map((g) => g.char)).toEqual(["口", "十", "。", "A"]);
    expect(json.glyphs[0]).toEqual({
      char: "口",
      codepoint: "U+53E3",
      file: "rawdata/vector/U+53E3.json",
    });
  });
});

describe("readArchive のエラー", () => {
  const projectJson = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ ...toProjectJson(sampleProject(), "x"), glyphs: [], ...over });

  it("zip でないファイル", async () => {
    await expect(
      readArchive(new TextEncoder().encode("hello").buffer as ArrayBuffer),
    ).rejects.toThrow(ArchiveError);
  });
  it("project.json がない（無関係な zip）", async () => {
    await expect(readArchive(await zipOf({ "a.txt": "x" }))).rejects.toThrow(/project.json がない/);
  });
  it("壊れた project.json", async () => {
    await expect(readArchive(await zipOf({ "project.json": "{" }))).rejects.toThrow(/壊れて/);
  });
  it("別の形式", async () => {
    await expect(
      readArchive(await zipOf({ "project.json": '{"format":"other"}' })),
    ).rejects.toThrow(/このアプリで保存した zip ではありません/);
    await expect(readArchive(await zipOf({ "project.json": "null" }))).rejects.toThrow(
      ArchiveError,
    );
  });
  it("新しすぎるバージョンはエラー、正しくないバージョンもエラー", async () => {
    await expect(
      readArchive(
        await zipOf({ "project.json": projectJson({ formatVersion: FORMAT_VERSION + 1 }) }),
      ),
    ).rejects.toThrow(/新しいバージョン/);
    await expect(
      readArchive(await zipOf({ "project.json": projectJson({ formatVersion: "x" }) })),
    ).rejects.toThrow(/formatVersion/);
  });
  it("内容が正しくない project.json", async () => {
    await expect(
      readArchive(await zipOf({ "project.json": projectJson({ queue: "x" }) })),
    ).rejects.toThrow(/queue/);
  });
  it("ファイル数・展開後のサイズの上限", async () => {
    const buf = await zipOf({ "project.json": projectJson(), "a.txt": "x".repeat(1000) });
    await expect(
      readArchive(buf, { maxFiles: 1, maxTotalBytes: 1e9, maxFileBytes: 1e9 }),
    ).rejects.toThrow(/多すぎ/);
    await expect(
      readArchive(buf, { maxFiles: 10, maxTotalBytes: 500, maxFileBytes: 1e9 }),
    ).rejects.toThrow(/大きすぎ/);
  });
  it("壊れたベクター JSON・想定外のパスはその文字だけ飛ばし、理由を返す", async () => {
    const glyphs = [
      { char: "口", codepoint: "U+53E3", file: vectorPath("U+53E3") },
      { char: "十", codepoint: "U+5341", file: vectorPath("U+5341") },
      { char: "A", codepoint: "U+0041", file: "../../etc/passwd" },
      { char: "B", codepoint: "U+0042", file: vectorPath("U+0042") },
      { char: "C", codepoint: "U+0043", file: vectorPath("U+0043") },
      { char: "D", codepoint: "U+0044", file: vectorPath("U+0044") },
      { char: "😀", codepoint: "U+1F600", file: vectorPath("U+1F600") },
    ];
    const buf = await zipOf({
      "project.json": projectJson({
        glyphs,
        queue: ["口", "十", "A", "B", "C", "D", "😀", "ab", "\n"],
      }),
      [vectorPath("U+53E3")]: JSON.stringify(KUCHI),
      [vectorPath("U+5341")]: "{broken",
      [vectorPath("U+0042")]: JSON.stringify({
        ...LATIN_A,
        char: "B",
        codepoint: "U+0042",
        canvasSize: 500,
      }),
      [vectorPath("U+0043")]: JSON.stringify(LATIN_A),
      [vectorPath("U+1F600")]: JSON.stringify({ ...KUCHI, char: "😀", codepoint: "U+1F600" }),
    });
    const { project, skipped } = await readArchive(buf);
    expect(Object.keys(project.glyphs)).toEqual(["口"]);
    expect(skipped.map((s) => s.char)).toEqual(["十", "A", "B", "C", "D", "😀"]);
    expect(skipped.find((s) => s.char === "D")!.reason).toMatch(/ありません/);
    // 一覧から正しくない文字（2 文字・改行・絵文字）は除く
    expect(project.queue).toEqual(["口", "十", "A", "B", "C", "D"]);
  });
  it("フォント名が使えない文字だけなら初期値にする", async () => {
    const json = JSON.parse(projectJson());
    json.font.familyName = "日本語";
    const { project } = await readArchive(await zipOf({ "project.json": JSON.stringify(json) }));
    expect(project.font.familyName).toBe("MyHandwriting");
  });
});

describe("展開後のサイズを偽った zip（zip bomb）", () => {
  /** 中央ディレクトリの「展開後のサイズ」を小さく書き換える */
  function lie(buf: ArrayBuffer): ArrayBuffer {
    const u8 = new Uint8Array(buf.slice(0));
    const v = new DataView(u8.buffer);
    const eocd = u8.length - 22;
    let p = v.getUint32(eocd + 16, true);
    for (let i = 0; i < v.getUint16(eocd + 10, true); i++) {
      v.setUint32(p + 24, 10, true);
      p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    }
    return u8.buffer;
  }
  const big = () =>
    JSON.stringify({
      ...toProjectJson(sampleProject(), "x"),
      glyphs: [],
      previewText: "あ".repeat(300_000),
    });

  it("申告値は小さくても、実際に展開した大きさで止める（合計）", async () => {
    const buf = lie(await zipOf({ "project.json": big() }));
    expect(readZipEntries(buf)[0]!.uncompressedSize).toBe(10);
    await expect(
      readArchive(buf, { maxFiles: 10, maxTotalBytes: 100_000, maxFileBytes: 1e9 }),
    ).rejects.toThrow(/大きすぎ/);
  });
  it("1 ファイルの上限", async () => {
    const buf = await zipOf({ "project.json": big() });
    await expect(
      readArchive(buf, { maxFiles: 10, maxTotalBytes: 1e9, maxFileBytes: 100_000 }),
    ).rejects.toThrow(/1 ファイル/);
  });
  it("ベクター JSON が上限を超えたら、その文字を飛ばさずに読み込みをやめる", async () => {
    const json = toProjectJson(sampleProject(), "x");
    const buf = await zipOf({
      "project.json": JSON.stringify(json),
      [vectorPath("U+53E3")]: JSON.stringify({ ...KUCHI, pad: "x".repeat(200_000) }),
    });
    await expect(
      readArchive(buf, { maxFiles: 100, maxTotalBytes: 1e9, maxFileBytes: 100_000 }),
    ).rejects.toThrow(/大きすぎ/);
  });
});

describe("migrations", () => {
  it("formatVersion 1 の zip は、描いた履歴なしとして読み込む", async () => {
    const { histories: _h, ...v1 } = { ...toProjectJson(sampleProject(), "x"), formatVersion: 1 };
    void _h;
    const buf = await zipOf({
      "project.json": JSON.stringify(v1),
      [vectorPath("U+53E3")]: JSON.stringify(KUCHI),
      [vectorPath("U+5341")]: JSON.stringify(JUU),
      [vectorPath("U+3002")]: JSON.stringify(MARU),
      [vectorPath("U+0041")]: JSON.stringify(LATIN_A),
    });
    const { project, skipped } = await readArchive(buf);
    expect(skipped).toEqual([]);
    expect(project.glyphs["口"]).toEqual(KUCHI);
    expect(project.drawings).toEqual({});
  });
  it("マイグレーションのない古いバージョンはエラー", async () => {
    const json = { ...toProjectJson(sampleProject(), "x"), glyphs: [], formatVersion: 0 };
    await expect(
      readArchive(await zipOf({ "project.json": JSON.stringify(json) })),
    ).rejects.toThrow(/formatVersion/);
    expect(Object.keys(migrations)).toEqual(["1"]);
  });
});

describe("描いた履歴", () => {
  it("文字ごとの履歴（やり直しできる操作を含む）を zip に入れ、読み込みで戻す", async () => {
    const p = sampleProject();
    let h = addStroke(createHistory(KUCHI.strokes), dot(1, 1));
    h = undo(clearStrokes(h));
    p.drawings = { 口: h, 未: addStroke(createHistory(), dot(5, 5)), 空: createHistory() };
    const zipped = await buildArchive({
      project: p,
      savedAt: "",
      ttf: null,
      otf: null,
      previews: new Map(),
    });
    const names = readZipEntries(toBuffer(zipped)).map((e) => e.name);
    expect(names).toContain("rawdata/history/U+53E3.json");
    expect(names).toContain("rawdata/history/U+672A.json");
    // 操作のない履歴は入れない
    expect(names).not.toContain("rawdata/history/U+7A7A.json");
    const { project, skipped } = await readArchive(toBuffer(zipped));
    expect(skipped).toEqual([]);
    expect(project.drawings["口"]).toEqual(h);
    expect(project.drawings["口"]!.position).toBe(h.ops.length - 1);
    expect(project.drawings["未"]).toEqual(p.drawings["未"]);
  });

  it("壊れた履歴は、その文字の履歴だけ飛ばす（字形は読み込む）", async () => {
    const json = toProjectJson(sampleProject(), "x");
    json.histories = [
      { char: "口", codepoint: "U+53E3", file: "rawdata/history/U+53E3.json" },
      { char: "十", codepoint: "U+5341", file: "rawdata/history/U+5341.json" },
      { char: "A", codepoint: "U+0041", file: "../x.json" },
      { char: "。", codepoint: "U+3002", file: "rawdata/history/U+3002.json" },
    ];
    const buf = await zipOf({
      "project.json": JSON.stringify(json),
      [vectorPath("U+53E3")]: JSON.stringify(KUCHI),
      [vectorPath("U+5341")]: JSON.stringify(JUU),
      "rawdata/history/U+53E3.json": JSON.stringify({
        char: "口",
        codepoint: "U+53E3",
        history: { ops: [], position: 3 },
      }),
      "rawdata/history/U+5341.json": "{",
    });
    const { project, skipped } = await readArchive(buf);
    expect(project.glyphs["口"]).toEqual(KUCHI);
    expect(project.drawings).toEqual({});
    expect(skipped.map((s) => s.char)).toEqual(expect.arrayContaining(["口", "十", "A", "。"]));
  });
});

describe("readZipEntries", () => {
  it("中央ディレクトリから名前と展開後のサイズを読む", async () => {
    const buf = await zipOf({ "a.txt": "hello", "dir/b.bin": new Uint8Array(300) });
    expect(readZipEntries(buf)).toEqual([
      expect.objectContaining({ name: "a.txt", uncompressedSize: 5 }),
      expect.objectContaining({ name: "dir/b.bin", uncompressedSize: 300 }),
    ]);
  });
  it("壊れた zip", async () => {
    const buf = new Uint8Array(await zipOf({ "a.txt": "hello" }));
    // 中央ディレクトリの先頭を壊す
    const view = new DataView(buf.buffer);
    const eocd = buf.length - 22;
    const cd = view.getUint32(eocd + 16, true);
    view.setUint32(cd, 0, true);
    expect(() => readZipEntries(buf.buffer)).toThrow(/壊れて/);
    view.setUint16(eocd + 10, 0xffff, true);
    expect(() => readZipEntries(buf.buffer)).toThrow(/ZIP64/);
  });
});
