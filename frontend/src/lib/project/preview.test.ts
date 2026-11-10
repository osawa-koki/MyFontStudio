import { describe, expect, it } from "vitest";
import {
  addMissingMessage,
  classifyMissing,
  createdText,
  missingChars,
  splitPreviewText,
} from "./preview";

const created = new Set(["大", "澤", "太"]);

describe("splitPreviewText", () => {
  it("作成済みと未作成の並びに分ける。改行・スペースは作成済みと同じ扱い", () => {
    expect(splitPreviewText("大澤太郎です\n大 澤　太", created)).toEqual([
      { text: "大澤太", missing: false },
      { text: "郎です", missing: true },
      { text: "\n大 澤　太", missing: false },
    ]);
  });
  it("サロゲートペアを 1 文字として扱う", () => {
    expect(splitPreviewText("𠮷大", created)).toEqual([
      { text: "𠮷", missing: true },
      { text: "大", missing: false },
    ]);
  });
  it("空の文章", () => {
    expect(splitPreviewText("", created)).toEqual([]);
  });
});

describe("missingChars", () => {
  it("未作成の文字を重複なしで出てきた順に", () => {
    expect(missingChars("大澤太郎です。太郎です", created)).toEqual(["郎", "で", "す", "。"]);
    expect(missingChars("大 \n　", created)).toEqual([]);
  });
});

describe("createdText", () => {
  it("作成済みの文字を一覧の順に連結する", () => {
    const g = { strokes: [1] };
    expect(createdText(["大", "未", "澤"], { 大: g, 澤: g, 未: { strokes: [] } })).toBe("大澤");
    expect(createdText(["未"], {})).toBe("");
  });
});

describe("addMissingMessage", () => {
  it("実際に追加した文字数と、すでに一覧にあった文字数を出す", () => {
    expect(addMissingMessage(["郎", "で"], ["郎", "で"])).toBe(
      "2 文字を入力ページの一覧に追加しました",
    );
    expect(addMissingMessage(["郎"], ["郎", "で", "す"])).toBe(
      "1 文字を入力ページの一覧に追加しました（2 文字はすでに一覧にあります）",
    );
    expect(addMissingMessage([], ["郎"])).toBe("1 文字は、すべて入力ページの一覧にあります");
  });
});

describe("未作成に数えない文字", () => {
  it("タブなどの空白・制御文字は未作成に数えない（文字一覧にも追加しない文字）", () => {
    expect(missingChars("大\t郎\u00a0\u200b", created)).toEqual(["郎"]);
  });
});

describe("classifyMissing", () => {
  it("一覧に追加できる文字と、対応していない文字（絵文字など）に分ける", () => {
    expect(classifyMissing(["郎", "😀", "で"])).toEqual({
      addable: ["郎", "で"],
      unsupported: ["😀"],
    });
    expect(classifyMissing(["😀"])).toEqual({ addable: [], unsupported: ["😀"] });
  });
});
