import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../project/project";
import { saveTiming, type SaveState } from "./saving";

const base = (): SaveState => ({ projectId: "a", project: createEmptyProject(), dirty: false });

describe("saveTiming", () => {
  it("プロジェクトを開いていない・ほかのタブで編集している・切り替えただけ・変わっていないときは保存しない", () => {
    const s = base();
    expect(saveTiming({ ...s, projectId: null }, s, true)).toBe("none");
    expect(saveTiming({ ...s, dirty: true }, s, false)).toBe("none");
    expect(saveTiming({ ...s, projectId: "b" }, s, true)).toBe("none");
    expect(saveTiming(s, s, true)).toBe("none");
  });
  it("文字・グリフ・描いた線・設定が変わればすぐ", () => {
    const s = base();
    for (const key of ["queue", "glyphs", "drawings", "font", "defaults"] as const) {
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
});
