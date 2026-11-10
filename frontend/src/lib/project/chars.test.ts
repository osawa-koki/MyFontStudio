import { describe, expect, it } from "vitest";
import { KUCHI, makeGlyph } from "../testing/fixtures";
import { PRESETS, isoWithOffset, nextUncreated, parseInputChars, prevChar } from "./chars";

describe("parseInputChars", () => {
  it("「大澤太郎」は 4 文字", () => {
    expect(parseInputChars("大澤太郎")).toEqual({
      accepted: ["大", "澤", "太", "郎"],
      unsupported: [],
    });
  });
  it("重複を除き、入力順を保つ", () => {
    expect(parseInputChars("あいあうい").accepted).toEqual(["あ", "い", "う"]);
  });
  it("サロゲートペアを 1 文字として扱う", () => {
    expect(parseInputChars("𠮷野家").accepted).toEqual(["𠮷", "野", "家"]);
  });
  it("空白・改行・制御文字は黙って除く", () => {
    expect(parseInputChars("あ い\n う\t\u3000\u200bえ\u0007")).toEqual({
      accepted: ["あ", "い", "う", "え"],
      unsupported: [],
    });
  });
  it("NFC 正規化してから取り込む", () => {
    expect(parseInputChars("か\u3099").accepted).toEqual(["が"]);
  });
  it("絵文字・結合文字・異体字セレクタ・私用領域は対応していない文字にする", () => {
    const r = parseInputChars("あ😀\u3099葛\u{E0100}\uE000🇯🇵©☆");
    expect(r.accepted).toEqual(["あ", "葛", "©", "☆"]);
    expect(r.unsupported).toEqual(["😀", "\u3099", "\u{E0100}", "\uE000", "🇯", "🇵"]);
  });
});

describe("PRESETS", () => {
  it("文字の数", () => {
    const n = Object.fromEntries(PRESETS.map((p) => [p.id, p.chars.length]));
    expect(n).toEqual({ hiragana: 85, katakana: 89, digits: 10, latin: 52, symbols: 47 });
  });
  it("プリセットの文字はすべて取り込める", () => {
    for (const p of PRESETS) {
      expect(parseInputChars(p.chars.join("")).accepted, p.id).toEqual(p.chars);
    }
  });
});

describe("nextUncreated / prevChar", () => {
  const glyphs = {
    口: KUCHI,
    大: makeGlyph("大", [{ points: [[1, 1, 0.5]] }]),
    空: makeGlyph("空", []),
  };
  const queue = ["大", "澤", "口", "空", "郎"];
  it("次の未作成の文字（最後まで行ったら先頭から）", () => {
    expect(nextUncreated(queue, glyphs, "大")).toBe("澤");
    expect(nextUncreated(queue, glyphs, "澤")).toBe("空");
    expect(nextUncreated(queue, glyphs, "郎")).toBe("澤");
    expect(nextUncreated(queue, glyphs, null)).toBe("澤");
  });
  it("表示している一覧（並び替え・絞り込みのあと）に今の文字がなければ、その一覧の先頭から探す", () => {
    // 「漢字」で絞り込んで、文字コード順に並べたときなど
    expect(nextUncreated(["郎", "澤"], glyphs, "大")).toBe("郎");
    expect(prevChar(["郎", "澤"], "大")).toBeNull();
    expect(prevChar(["郎", "澤"], "澤")).toBe("郎");
  });
  it("未作成がほかになければ null", () => {
    expect(nextUncreated(["大", "口"], glyphs, "大")).toBeNull();
    expect(nextUncreated(["大", "澤"], glyphs, "澤")).toBeNull();
    expect(nextUncreated([], glyphs, null)).toBeNull();
  });
  it("ひとつ前の文字", () => {
    expect(prevChar(queue, "澤")).toBe("大");
    expect(prevChar(queue, "大")).toBeNull();
    expect(prevChar(queue, null)).toBeNull();
  });
});

describe("isoWithOffset", () => {
  it("オフセット付きの ISO 8601", () => {
    const s = isoWithOffset(new Date("2026-11-07T11:30:05Z"));
    expect(s).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
    expect(new Date(s).getTime()).toBe(new Date("2026-11-07T11:30:05Z").getTime());
  });
});
