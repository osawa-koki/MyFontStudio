import { describe, expect, it } from "vitest";
import { canEditInThisTab, isLockedOut, takeoverFailedFor, useTabLockStore } from "./tabLockStore";

const A = "0b8e6c4e-2f1a-4c3b-9d5e-7a6b5c4d3e2f";
const B = "1c9f7d5f-3a2b-4d4c-8e6f-8b7c6d5e4f30";

describe("tabLockStore", () => {
  it("引き継げなかったことは、そのプロジェクトのときだけ出す（別のプロジェクトでは出さない）", () => {
    const s = useTabLockStore.getState();
    s.setTakeoverFailed(A);
    expect(takeoverFailedFor(useTabLockStore.getState(), A)).toBe(true);
    expect(takeoverFailedFor(useTabLockStore.getState(), B)).toBe(false);
    expect(takeoverFailedFor(useTabLockStore.getState(), null)).toBe(false);
    s.setTakeoverFailed(null);
    expect(takeoverFailedFor(useTabLockStore.getState(), A)).toBe(false);
  });

  it("引き継いでいる途中（takeover）は保存せず、ヘッダーの操作もさせない", () => {
    const s = useTabLockStore.getState();
    s.set("takeover", A);
    expect(canEditInThisTab(A)).toBe(false);
    expect(isLockedOut()).toBe(true);
    s.set("owner", A);
    expect(canEditInThisTab(A)).toBe(true);
    expect(canEditInThisTab(B)).toBe(false);
    expect(isLockedOut()).toBe(false);
  });
});
