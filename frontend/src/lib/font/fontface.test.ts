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
  it("あとから始めた登録が先に終わったら、前の登録は新しい FontFace を消さずに null", async () => {
    const added: string[] = [];
    const deleted: string[] = [];
    const loads: (() => void)[] = [];
    class SlowFontFace {
      constructor(public family: string) {}
      load() {
        return new Promise<this>((resolve) => loads.push(() => resolve(this)));
      }
    }
    const host = {
      FontFace: SlowFontFace as unknown as FontFaceHost["FontFace"],
      fonts: {
        add: (f: FontFace) => added.push(f.family),
        delete: (f: FontFace) => deleted.push(f.family),
      },
    };
    const first = registerPreviewFont(new ArrayBuffer(0), host);
    const second = registerPreviewFont(new ArrayBuffer(0), host);
    loads[1]!(); // あとの登録が先に読み込み終わる
    const b = await second;
    loads[0]!();
    expect(await first).toBeNull();
    expect(added).toEqual([b]);
    expect(deleted).not.toContain(b);
    unregisterPreviewFont(host);
  });
  it("ブラウザでなければ何もしない", async () => {
    expect(await registerPreviewFont(new ArrayBuffer(0))).toBeNull();
    expect(() => unregisterPreviewFont()).not.toThrow();
  });
});
