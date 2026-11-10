import { describe, expect, it } from "vitest";
import {
  distinguishingId,
  sameFamilyName,
  sameFamilyNameMessage,
  uniqueFamilyName,
} from "./display";
import type { ProjectSummary } from "./repository";

const p = (id: string, familyName: string, familyNameJa = ""): ProjectSummary => ({
  id,
  familyName,
  familyNameJa,
  charCount: 0,
  glyphCount: 0,
  updatedAt: "",
});

describe("distinguishingId", () => {
  it("同じ名前が複数あるときだけ uuid の先頭 8 文字", () => {
    const list = [
      p("aaaaaaaa-1", "A"),
      p("bbbbbbbb-2", "A"),
      p("cccccccc-3", "A", "あ"),
      p("dddddddd-4", "B"),
    ];
    expect(distinguishingId(list[0]!, list)).toBe("aaaaaaaa");
    expect(distinguishingId(list[1]!, list)).toBe("bbbbbbbb");
    expect(distinguishingId(list[2]!, list)).toBeNull();
    expect(distinguishingId(list[3]!, list)).toBeNull();
  });
});

describe("同じフォント名", () => {
  const all = [p("a", "MyHandwriting"), p("b", "Foo", "大澤"), p("c", "myhandwriting2")];
  it("自分を除き、大文字・小文字を区別せずに同じフォント名のプロジェクトを返す", () => {
    expect(sameFamilyName("MYHANDWRITING", all, null).map((x) => x.id)).toEqual(["a"]);
    expect(sameFamilyName("MyHandwriting", all, "a")).toEqual([]);
    expect(sameFamilyName("Bar", all, null)).toEqual([]);
  });
  it("重ならない名前は、base・base2・base3…（31 文字に収める）", () => {
    expect(uniqueFamilyName("Bar", all)).toBe("Bar");
    expect(uniqueFamilyName("MyHandwriting", all)).toBe("MyHandwriting3");
    const long = "A".repeat(31);
    expect(uniqueFamilyName(long, [p("x", long)])).toBe("A".repeat(30) + "2");
  });
  it("説明に、同じ名前のプロジェクトと上書きされることを書く", () => {
    const m = sameFamilyNameMessage("Foo", [all[1]!]);
    expect(m).toContain("Foo（大澤）");
    expect(m).toContain("上書き");
  });
});
