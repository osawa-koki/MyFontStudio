import { describe, expect, it } from "vitest";
import { saveShortcut, type KeyLike } from "./shortcuts";

const key = (k: Partial<KeyLike>): KeyLike => ({
  key: "s",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  isComposing: false,
  ...k,
});

describe("saveShortcut", () => {
  it("Cmd/Ctrl+S は保存、Shift 付きは zip で保存", () => {
    expect(saveShortcut(key({ metaKey: true }))).toBe("save");
    expect(saveShortcut(key({ ctrlKey: true }))).toBe("save");
    // Shift を押すと key は大文字になる
    expect(saveShortcut(key({ metaKey: true, shiftKey: true, key: "S" }))).toBe("saveZip");
  });
  it("修飾キーなし・Alt 付き・変換中・ほかのキーは対象外", () => {
    expect(saveShortcut(key({}))).toBeNull();
    expect(saveShortcut(key({ ctrlKey: true, altKey: true }))).toBeNull();
    expect(saveShortcut(key({ metaKey: true, isComposing: true }))).toBeNull();
    expect(saveShortcut(key({ metaKey: true, key: "a" }))).toBeNull();
  });
});
