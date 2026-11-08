import { describe, expect, it } from "vitest";
import { registerPreviewFont, unregisterPreviewFont, type FontFaceHost } from "./fontface";

function fakeHost() {
  const added: string[] = [];
  const deleted: string[] = [];
  class FakeFontFace {
    constructor(public family: string) {}
    async load() {
      return this;
    }
  }
  const host = {
    FontFace: FakeFontFace as unknown as FontFaceHost["FontFace"],
    fonts: {
      add: (f: FontFace) => added.push(f.family),
      delete: (f: FontFace) => deleted.push(f.family),
    },
  };
  return { host, added, deleted };
}

describe("registerPreviewFont", () => {
  it("登録のたびに名前を変え、前の FontFace を消す", async () => {
    const { host, added, deleted } = fakeHost();
    const a = await registerPreviewFont(new ArrayBuffer(0), host);
    const b = await registerPreviewFont(new ArrayBuffer(0), host);
    expect(a).toMatch(/^hw-preview-\d+$/);
    expect(b).not.toBe(a);
    expect(added).toEqual([a, b]);
    expect(deleted).toEqual([a]);
    unregisterPreviewFont(host);
    expect(deleted).toEqual([a, b]);
    unregisterPreviewFont(host);
    expect(deleted).toEqual([a, b]);
  });
  it("ブラウザでなければ何もしない", async () => {
    expect(await registerPreviewFont(new ArrayBuffer(0))).toBeNull();
    expect(() => unregisterPreviewFont()).not.toThrow();
  });
});
