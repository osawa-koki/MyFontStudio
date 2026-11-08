import { expect, type Page } from "@playwright/test";

/** アプリが IndexedDB（idb-keyval の keyval-store）に保存した値を読む */
export async function readStored(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) {
            db.close();
            resolve(undefined);
            return;
          }
          const get = db.transaction("keyval", "readonly").objectStore("keyval").get(k);
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
          get.onerror = () => reject(get.error);
        };
      }),
    key,
  );
}

/** 保存した値が条件を満たすまで待つ（自動保存を時間で待たない） */
export async function waitForStored(
  page: Page,
  key: string,
  predicate: (value: unknown) => boolean,
): Promise<void> {
  await expect
    .poll(async () => predicate(await readStored(page, key)), { timeout: 10_000 })
    .toBe(true);
}

/** 今開いているプロジェクトの uuid（URL の ?uuid=） */
export function currentUuid(page: Page): string {
  const uuid = new URL(page.url()).searchParams.get("uuid");
  if (!uuid) throw new Error("URL に uuid がない");
  return uuid;
}
