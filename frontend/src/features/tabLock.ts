import { useEffect } from "react";
import { useTabLockStore } from "../store/tabLockStore";
import { flushProjectSave, reloadProject } from "./projects";

/**
 * 同じプロジェクトを複数のタブで編集して、あとから保存したタブの内容で上書きされないようにする。
 * Web Locks API でプロジェクトごとの排他のロックを取り、持っているタブだけが編集・保存する。
 * ほかのタブに「引き継いで」と頼むときは BroadcastChannel で知らせる
 */
const lockName = (id: string) => `myfontstudio:project:${id}`;
const CHANNEL = "myfontstudio";

type Message = { type: "takeover"; id: string };

let held: { id: string; release: () => void } | null = null;
let channel: BroadcastChannel | null = null;

const supported = () =>
  typeof navigator !== "undefined" &&
  "locks" in navigator &&
  typeof BroadcastChannel !== "undefined";

/** ロックを取る。waitIfHeld なら空くまで待つ。取れたら true */
function lock(id: string, waitIfHeld: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks
      .request(lockName(id), waitIfHeld ? {} : { ifAvailable: true }, (l) => {
        if (!l) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        // このタブで持ち続ける（release を呼ぶまで）
        return new Promise<void>((release) => {
          held = { id, release };
        });
      })
      .catch(() => resolve(false));
  });
}

function release(id: string): void {
  if (held?.id === id) {
    held.release();
    held = null;
  }
}

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    // ほかのタブから「引き継いで」と頼まれたら、保存を済ませてからロックを手放し、このタブでの編集を止める
    channel.onmessage = async (e: MessageEvent<Message>) => {
      if (e.data.type !== "takeover" || held?.id !== e.data.id) return;
      useTabLockStore.getState().set("released");
      await flushProjectSave();
      release(e.data.id);
    };
  }
  return channel;
}

/** このタブで編集できるようにする（ほかのタブの編集を止めてもらい、最新の内容を読み直す） */
export async function takeOverProject(id: string): Promise<void> {
  if (!supported()) return;
  const store = useTabLockStore.getState();
  store.set("pending");
  getChannel().postMessage({ type: "takeover", id } satisfies Message);
  await lock(id, true);
  await reloadProject(id);
  useTabLockStore.getState().set("owner");
}

/** プロジェクトを開いている間、ロックを持つ。取れなければ blocked（ほかのタブで編集している） */
export function useProjectLock(id: string | null): void {
  useEffect(() => {
    const store = useTabLockStore.getState();
    if (!supported()) {
      store.set("unsupported");
      return;
    }
    if (!id) return;
    let cancelled = false;
    store.set("pending");
    getChannel();
    void lock(id, false).then((ok) => {
      if (cancelled) {
        if (ok) release(id);
        return;
      }
      useTabLockStore.getState().set(ok ? "owner" : "blocked");
    });
    return () => {
      cancelled = true;
      release(id);
    };
  }, [id]);
}

/** 書き込みをタブをまたいで順番に行う（一覧の読み書きが、ほかのタブの書き込みと混ざらないように） */
export function withStorageLock<T>(op: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return op();
  return navigator.locks.request("myfontstudio:storage", op) as Promise<T>;
}
