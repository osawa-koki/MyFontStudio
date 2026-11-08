import { describe, expect, it } from "vitest";
import { formatBytes, getStorageStatus, requestPersistence } from "./storage";

describe("getStorageStatus", () => {
  it("永続化の状態と使用量", async () => {
    const s = await getStorageStatus({
      persisted: async () => true,
      persist: async () => true,
      estimate: async () => ({ usage: 100, quota: 1000 }),
    });
    expect(s).toEqual({ persisted: true, canPersist: true, usage: 100, quota: 1000 });
  });
  it("Storage API がない・失敗したときは null", async () => {
    expect(await getStorageStatus(undefined)).toEqual({
      persisted: null,
      canPersist: false,
      usage: null,
      quota: null,
    });
    const s = await getStorageStatus({
      persisted: () => Promise.reject(new Error("x")),
      estimate: () => Promise.reject(new Error("x")),
    });
    expect(s).toMatchObject({ persisted: null, usage: null });
  });
});

describe("requestPersistence", () => {
  it("すでに永続化されていれば頼まない", async () => {
    let asked = 0;
    const ok = await requestPersistence({
      persisted: async () => true,
      persist: async () => {
        asked++;
        return true;
      },
    });
    expect(ok).toBe(true);
    expect(asked).toBe(0);
  });
  it("永続化されていなければ頼み、結果を返す", async () => {
    expect(
      await requestPersistence({ persisted: async () => false, persist: async () => false }),
    ).toBe(false);
    expect(await requestPersistence({ persist: async () => true })).toBe(true);
  });
  it("頼めない・失敗したときは false", async () => {
    expect(await requestPersistence(undefined)).toBe(false);
    expect(await requestPersistence({ persist: () => Promise.reject(new Error("x")) })).toBe(false);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1536, "1.5 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
    [300 * 1024 * 1024, "300 MB"],
    [2 * 1024 ** 3, "2.0 GB"],
    [5 * 1024 ** 5, "5120 TB"],
  ])("%d → %s", (n, s) => {
    expect(formatBytes(n)).toBe(s);
  });
});
