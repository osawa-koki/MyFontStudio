import { describe, expect, it } from "vitest";
import { makeGlyph, dot } from "../testing/fixtures";
import {
  DEFAULT_VIEW,
  charKind,
  isFiltered,
  matchesQuery,
  viewQueue,
  type QueueViewOptions,
} from "./queueView";

const at = (char: string, time: string) => ({ ...makeGlyph(char, [dot(1, 1)]), updatedAt: time });
const queue = ["澤", "あ", "A", "ア", "1", "。", "大", "ー"];
const glyphs = {
  あ: at("あ", "2026-11-08T10:00:00+09:00"),
  大: at("大", "2026-11-08T09:00:00+09:00"),
  A: at("A", "2026-11-08T11:00:00+09:00"),
  空: makeGlyph("空", []),
};
const view = (o: Partial<QueueViewOptions>) => viewQueue(queue, glyphs, { ...DEFAULT_VIEW, ...o });

describe("charKind", () => {
  it.each([
    ["あ", "hiragana"],
    ["ゞ", "hiragana"],
    ["ア", "katakana"],
    ["ー", "katakana"],
    ["ｱ", "katakana"],
    ["大", "kanji"],
    ["々", "kanji"],
    ["𠮷", "kanji"],
    ["A", "latin"],
    ["é", "latin"],
    ["1", "digit"],
    ["１", "digit"],
    ["。", "symbol"],
    ["!", "symbol"],
    ["©", "symbol"],
    ["α", "other"],
  ])("%s は %s", (c, kind) => {
    expect(charKind(c)).toBe(kind);
  });
});

describe("matchesQuery", () => {
  it("空なら合う。入力に含まれる文字に合う", () => {
    expect(matchesQuery("大", " ")).toBe(true);
    expect(matchesQuery("大", "大澤")).toBe(true);
    expect(matchesQuery("太", "大澤")).toBe(false);
  });
  it("コードポイントの一部に合う（U+ はあってもなくてもよく、大文字・小文字を区別しない）", () => {
    expect(matchesQuery("あ", "U+3042")).toBe(true);
    expect(matchesQuery("あ", "u+30")).toBe(true);
    expect(matchesQuery("あ", "3042")).toBe(true);
    expect(matchesQuery("あ", "4e")).toBe(false);
    expect(matchesQuery("大", "5927")).toBe(true);
  });
});

describe("viewQueue", () => {
  it("既定は登録順のまま", () => {
    expect(view({})).toEqual(queue);
    expect(view({ desc: true })).toEqual([...queue].reverse());
  });
  it("文字コード順", () => {
    expect(view({ sort: "codepoint" })).toEqual(["1", "A", "。", "あ", "ア", "ー", "大", "澤"]);
    expect(view({ sort: "codepoint", desc: true })[0]).toBe("澤");
  });
  it("更新日時順。未作成は向きによらず最後（登録順）", () => {
    expect(view({ sort: "updated" })).toEqual(["大", "あ", "A", "澤", "ア", "1", "。", "ー"]);
    expect(view({ sort: "updated", desc: true })).toEqual([
      "A",
      "あ",
      "大",
      "澤",
      "ア",
      "1",
      "。",
      "ー",
    ]);
  });
  it("状態・種類・検索で絞り込む", () => {
    expect(view({ status: "created" })).toEqual(["あ", "A", "大"]);
    expect(view({ status: "uncreated" })).toEqual(["澤", "ア", "1", "。", "ー"]);
    expect(view({ kind: "katakana" })).toEqual(["ア", "ー"]);
    expect(view({ query: "大澤太郎" })).toEqual(["澤", "大"]);
    expect(view({ query: "U+30", status: "uncreated" })).toEqual(["ア", "。", "ー"]);
  });
  it("isFiltered", () => {
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, sort: "codepoint" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, query: "a" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_VIEW, kind: "kanji" })).toBe(true);
  });
});
