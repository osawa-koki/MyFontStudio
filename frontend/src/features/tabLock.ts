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

/** このタブで持っているロック（プロジェクトの ID → 手放す関数） */
const held = new Map<string, () => void>();
/** プロジェクトを閉じて・切り替えてから、手放すのを少し待つ（その間に同じプロジェクトを開き直せば手放さない。プロジェクトごと） */
const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const RELEASE_DELAY_MS = 1000;
let channel: BroadcastChannel | null = null;

/** Web Locks API があるか（HTTPS でないページなどでは navigator.locks がない・null のことがある） */
const hasLocks = () =>
  typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
const supported = () => hasLocks() && typeof BroadcastChannel !== "undefined";

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
          held.set(id, release);
        });
      })
      .catch(() => resolve(false));
  });
}

function release(id: string): void {
  held.get(id)?.();
  held.delete(id);
}

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    // ほかのタブから「引き継いで」と頼まれたら、保存を済ませてからロックを手放し、このタブでの編集を止める
    channel.onmessage = async (e: MessageEvent<Message>) => {
      const { id } = e.data;
      if (e.data.type !== "takeover" || !held.has(id)) return;
      // 待っている保存を、まだロックを持っているうちに書いてから、編集を止める
      await flushProjectSave();
      useTabLockStore.getState().set("released", id);
      release(id);
    };
  }
  return channel;
}

/** このタブで編集できるようにする（ほかのタブの編集を止めてもらい、最新の内容を読み直す） */
export async function takeOverProject(id: string): Promise<void> {
  if (!supported()) return;
  const store = useTabLockStore.getState();
  store.set("pending", id);
  getChannel().postMessage({ type: "takeover", id } satisfies Message);
  await lock(id, true);
  await reloadProject(id);
  useTabLockStore.getState().set("owner", id);
}

/**
 * プロジェクトを開いている間（使い方ページに移っても）、ロックを持つ。取れなければ blocked（ほかのタブで編集している）。
 * AppShell で、開いているプロジェクトの ID を渡して 1 回だけ使う
 */
export function useProjectLock(id: string | null): void {
  useEffect(() => {
    const store = useTabLockStore.getState();
    if (!supported()) {
      store.set("unsupported", id);
      return;
    }
    if (!id) {
      store.set("pending", null);
      return;
    }
    // 同じプロジェクトのロックをすでに持っていれば、手放さずに使い続ける（開き直しただけ）
    if (held.has(id)) {
      clearTimeout(releaseTimers.get(id));
      releaseTimers.delete(id);
      store.set("owner", id);
      return () => scheduleRelease(id);
    }
    let cancelled = false;
    store.set("pending", id);
    getChannel();
    void lock(id, false).then((ok) => {
      if (cancelled) {
        if (ok) release(id);
        return;
      }
      useTabLockStore.getState().set(ok ? "owner" : "blocked", id);
    });
    return () => {
      cancelled = true;
      scheduleRelease(id);
    };
  }, [id]);
}

/** 少し待ってからロックを手放す（その間に同じプロジェクトを開けば手放さない） */
function scheduleRelease(id: string): void {
  clearTimeout(releaseTimers.get(id));
  releaseTimers.set(
    id,
    setTimeout(() => {
      releaseTimers.delete(id);
      release(id);
    }, RELEASE_DELAY_MS),
  );
}

/** 書き込みをタブをまたいで順番に行う（一覧の読み書きが、ほかのタブの書き込みと混ざらないように） */
export function withStorageLock<T>(op: () => Promise<T>): Promise<T> {
  if (!hasLocks()) return op();
  return navigator.locks.request("myfontstudio:storage", op) as Promise<T>;
}
