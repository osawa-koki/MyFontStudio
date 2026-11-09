import { describe, expect, it } from "vitest";
import { distinguishingId } from "./display";
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
