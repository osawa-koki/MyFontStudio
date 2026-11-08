import { describe, expect, it } from "vitest";
import { missingChars, splitPreviewText } from "./preview";

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
