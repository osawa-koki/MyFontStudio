import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../project/project";
import { isQuotaError, saveFailedMessage, saveTiming, type SaveState } from "./saving";

const base = (): SaveState => ({ projectId: "a", project: createEmptyProject(), dirty: false });

describe("saveTiming", () => {
  it("プロジェクトを開いていない・ほかのタブで編集している・切り替えただけ・変わっていないときは保存しない", () => {
    const s = base();
    expect(saveTiming({ ...s, projectId: null }, s, true)).toBe("none");
    expect(saveTiming({ ...s, dirty: true }, s, false)).toBe("none");
    expect(saveTiming({ ...s, projectId: "b" }, s, true)).toBe("none");
    expect(saveTiming(s, s, true)).toBe("none");
  });
  it("文字・グリフ・描いた線・フォントの設定が変わればすぐ", () => {
    const s = base();
    for (const key of ["queue", "glyphs", "drawings", "font"] as const) {
      const project = {
        ...s.project,
        [key]: Array.isArray(s.project[key]) ? [] : { ...s.project[key] },
      };
      expect(saveTiming({ ...s, project }, s, true), key).toBe("now");
    }
  });
  it("文章や未保存の印だけなら待ってまとめる", () => {
    const s = base();
    expect(saveTiming({ ...s, project: { ...s.project, previewText: "あ" } }, s, true)).toBe(
      "later",
    );
    expect(saveTiming({ ...s, dirty: true }, s, true)).toBe("later");
  });
  it("ペンの設定（太さ・筆圧・お手本）は待ってまとめる（スライダーはドラッグ中に何度も変わる）", () => {
    const s = base();
    const defaults = { ...s.project.defaults, pen: { ...s.project.defaults.pen, size: 60 } };
    expect(saveTiming({ ...s, project: { ...s.project, defaults }, dirty: true }, s, true)).toBe(
      "later",
    );
  });
});

describe("保存の失敗", () => {
  it("容量の不足（QuotaExceededError）を見分け、文言で zip での保存を案内する", () => {
    expect(isQuotaError(new DOMException("x", "QuotaExceededError"))).toBe(true);
    expect(isQuotaError(new Error("x"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(saveFailedMessage(true)).toMatch(/容量.*zip で保存/);
    expect(saveFailedMessage(false)).toMatch(/zip で保存/);
  });
});
