import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "../lib/project/project";
import { useTaskStore } from "../store/taskStore";
import { TaskBusyError, runInWorker } from "./worker";

// Node には Worker がないので、画面のスレッドで同じ処理を動かす（runInWorker の進み具合・同時実行の扱いを確かめる）
const task = () => ({
  kind: "buildFont" as const,
  format: "ttf" as const,
  outlines: [],
  font: createEmptyProject().font,
});

describe("runInWorker", () => {
  beforeEach(() => useTaskStore.getState().set(null));

  it("進み具合を出す処理は同時に 1 つだけ。動いている間に始めると TaskBusyError（表示中の処理は残る）", async () => {
    const first = runInWorker(task(), { label: "zip に保存しています" });
    expect(useTaskStore.getState().task?.label).toBe("zip に保存しています");
    await expect(runInWorker(task(), { label: "フォントを作っています" })).rejects.toThrow(
      TaskBusyError,
    );
    await expect(runInWorker(task(), { label: "x" })).rejects.toThrow(
      "ほかの処理（zip に保存しています）が終わるまでお待ちください",
    );
    // 2 つ目が失敗しても、1 つ目の表示は消えない
    expect(useTaskStore.getState().task?.label).toBe("zip に保存しています");
    await first;
    expect(useTaskStore.getState().task).toBeNull();
    // 終われば始められる
    await expect(runInWorker(task(), { label: "フォントを作っています" })).resolves.toBeNull();
  });

  it("進み具合を出さない処理（プレビュー用のフォントの生成）は、ほかの処理が動いていても動く", async () => {
    const first = runInWorker(task(), { label: "zip に保存しています" });
    await expect(runInWorker(task())).resolves.toBeNull();
    await first;
  });
});
