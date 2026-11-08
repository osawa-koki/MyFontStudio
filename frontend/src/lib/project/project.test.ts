import { describe, expect, it } from "vitest";
import {
  countGlyphs,
  createEmptyProject,
  fromCodepointLabel,
  sanitizeDisplayName,
  sanitizeFamilyName,
  toCodepointLabel,
} from "./project";

describe("toCodepointLabel / fromCodepointLabel", () => {
  it.each([
    ["あ", "U+3042"],
    ["A", "U+0041"],
    ["大", "U+5927"],
    ["𠮷", "U+20BB7"],
  ])("%s ⇔ %s", (char, label) => {
    expect(toCodepointLabel(char)).toBe(label);
    expect(fromCodepointLabel(label)).toBe(char);
  });

  it("空の文字は例外", () => {
    expect(() => toCodepointLabel("")).toThrow();
  });

  it.each(["U+41", "u+3042", "U+3042x", "3042", "U+110000", "U+D800", "U+1234567"])(
    "形が正しくない %s は null",
    (label) => {
      expect(fromCodepointLabel(label)).toBeNull();
    },
  );
});

describe("sanitizeFamilyName", () => {
  it("英数字以外を取り除く", () => {
    expect(sanitizeFamilyName("My Hand-writing_01!")).toBe("MyHandwriting01");
    expect(sanitizeFamilyName("大澤")).toBe("");
  });
  it("31 文字に切る", () => {
    expect(sanitizeFamilyName("a".repeat(40))).toHaveLength(31);
  });
});

describe("sanitizeDisplayName", () => {
  it("制御文字と前後の空白を落とし、31 文字に切る", () => {
    expect(sanitizeDisplayName("  大澤\n手書き\t ")).toBe("大澤手書き");
    expect(Array.from(sanitizeDisplayName("𠮷".repeat(40)))).toHaveLength(31);
  });
});

describe("createEmptyProject", () => {
  it("初期値", () => {
    const p = createEmptyProject();
    expect(p.font.familyName).toBe("MyHandwriting");
    expect(p.defaults.pen).toEqual({ size: 40, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
    expect(p.defaults.usePressure).toBe(true);
    expect(p.queue).toEqual([]);
  });
  it("フォント名を直す。空になれば初期値", () => {
    expect(createEmptyProject("Foo Bar").font.familyName).toBe("FooBar");
    expect(createEmptyProject("日本語").font.familyName).toBe("MyHandwriting");
  });
});

describe("countGlyphs", () => {
  it("ストロークのあるグリフだけ数える", () => {
    const p = createEmptyProject();
    const base = {
      codepoint: "U+0041",
      canvasSize: 1000 as const,
      widthMode: "auto" as const,
      pen: { size: 40, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: true },
      updatedAt: "",
    };
    p.glyphs.A = { ...base, char: "A", strokes: [{ points: [[0, 0, 0.5]] }] };
    p.glyphs.B = { ...base, char: "B", strokes: [] };
    expect(countGlyphs(p)).toBe(1);
  });
});
