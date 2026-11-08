import { describe, expect, it } from "vitest";
import { askDialog, confirmDialog, notify, useUiStore } from "./uiStore";

describe("uiStore", () => {
  it("notify と dismissToast", () => {
    notify("a", "error");
    notify("b", "info", ["x"]);
    const ids = useUiStore.getState().toasts.map((t) => t.id);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(["a", "b"]);
    useUiStore.getState().dismissToast(ids[0]!);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(["b"]);
  });

  it("askDialog は押されたボタンの値と入力を返す", async () => {
    const p = askDialog({
      title: "t",
      buttons: [{ label: "A", value: "a" }],
      cancelValue: "cancel",
      input: { label: "名前", value: "" },
    });
    useUiStore.getState().closeDialog("a", "Foo");
    await expect(p).resolves.toEqual({ value: "a", input: "Foo" });
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it("前のダイアログが開いていればキャンセルにする", async () => {
    const first = askDialog({ title: "1", buttons: [], cancelValue: "no" });
    const second = confirmDialog("2");
    await expect(first).resolves.toEqual({ value: "no", input: "" });
    useUiStore.getState().closeDialog("ok");
    await expect(second).resolves.toBe(true);
  });
});
