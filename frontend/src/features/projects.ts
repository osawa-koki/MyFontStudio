import { del, delMany, get, getMany, set, setMany } from "idb-keyval";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { nextUncreated } from "../lib/project/chars";
import {
  SAVE_DELAY_MS,
  createProjectId,
  debounce,
  deleteProject,
  hasContent,
  isProjectId,
  listProjects,
  loadProject,
  migrateLegacyAutosave,
  saveProject,
  type KeyValueStore,
  type ProjectSummary,
} from "../lib/projects/repository";
import { requestPersistence } from "../lib/projects/storage";
import { isQuotaError, saveFailedMessage, saveTiming } from "../lib/projects/saving";
import { useEditorStore } from "../store/editorStore";
import { useSaveStatusStore } from "../store/saveStatusStore";
import { canEditInThisTab } from "../store/tabLockStore";
import { withStorageLock } from "./tabLock";
import { useProjectStore } from "../store/projectStore";
import { notify } from "../store/uiStore";
import type { Project } from "../types/project";

/** IndexedDB（idb-keyval）。プライベートブラウズ・容量の不足などで保存に失敗したら、通知してヘッダーに出す（saveStatusStore） */
const idb: KeyValueStore = { get, getMany, set, setMany, del, delMany };

/** 保存したことのあるプロジェクトの ID（中身が空になっても保存し続ける） */
const stored = new Set<string>();

/** プロジェクトごとの、最後に保存した（または読み込んだ）内容。変わった文字のグリフ・描いた履歴だけを書くのに使う */
const lastSaved = new Map<string, Project>();

/** IndexedDB への書き込みは 1 本の列に並べて順に行う（一覧の書き換えが並行して消えないように） */
let writes: Promise<void> = Promise.resolve();
let pendingWrites = 0;
/** track：終わるまでタブを閉じる前に警告する書き込み（プロジェクトの保存）か */
function enqueue(op: () => Promise<void>, track = true): Promise<void> {
  if (track) pendingWrites++;
  writes = writes
    // タブをまたいで順番に書く（一覧の読み書きが、ほかのタブの書き込みと混ざらないように）
    .then(() => withStorageLock(op))
    .catch((e) => console.warn("プロジェクトの保存に失敗しました", e))
    .finally(() => {
      if (track) pendingWrites--;
    });
  return writes;
}

/**
 * IndexedDB への書き込みが終わっていない（または 500ms 待っている）保存があるか。
 * 保存に失敗したままのとき（保存できていない変更があるとき）も true
 */
export function hasPendingSave(): boolean {
  return pendingWrites > 0 || saveLater.pending() || useSaveStatusStore.getState().failed;
}

/** 保存に失敗した。続けて失敗しているあいだは通知を重ねない（容量の不足に変わったときだけ、改めて知らせる） */
function onSaveFailed(e: unknown): void {
  const quota = isQuotaError(e);
  const status = useSaveStatusStore.getState();
  if (!status.failed || (quota && !status.quota)) notify(saveFailedMessage(quota), "error");
  status.set({ failed: true, quota });
}

/** 保存に成功した。失敗していたなら、状態を戻して知らせる */
function onSaveSucceeded(): void {
  const status = useSaveStatusStore.getState();
  if (!status.failed) return;
  status.set({ failed: false, quota: false });
  notify("ブラウザに保存できるようになりました", "success");
}

/** ブラウザに永続化を頼んだか（1 回の表示で 1 回だけ頼む） */
let persistRequested = false;

/** 空き容量が足りなくなってもブラウザが自動で消さないよう、永続化を頼む（初めて保存するとき） */
function askPersistenceOnce(): void {
  if (persistRequested || typeof navigator === "undefined") return;
  persistRequested = true;
  void requestPersistence(navigator.storage);
}

function save(id: string, project: Project, dirty: boolean): Promise<void> {
  // 文字が 1 つもない新しいプロジェクトは、一覧を散らかさないよう保存しない
  if (!stored.has(id) && !hasContent(project)) return writes;
  stored.add(id);
  askPersistenceOnce();
  return enqueue(async () => {
    try {
      await saveProject(idb, id, project, dirty, new Date(), lastSaved.get(id));
    } catch (e) {
      onSaveFailed(e);
      throw e;
    }
    lastSaved.set(id, project);
    onSaveSucceeded();
  });
}

const saveLater = debounce((id: string, project: Project, dirty: boolean) => {
  void save(id, project, dirty);
}, SAVE_DELAY_MS);

/** 待っている保存を済ませる（別のプロジェクトに切り替える前・一覧を読む前）。書き込みが終わるまで待てる */
export function flushProjectSave(): Promise<void> {
  saveLater.flush();
  return writes;
}

/** 開いているプロジェクトを今すぐ保存する（新しく作った・zip から読み込んだとき。空でも一覧に出す） */
export async function saveCurrentProjectNow(): Promise<void> {
  saveLater.cancel();
  const { projectId, project, dirty } = useProjectStore.getState();
  if (!projectId) return;
  stored.add(projectId);
  await save(projectId, project, dirty);
}

/** 保存したプロジェクトの一覧（待っている保存が済んでから読む） */
export async function listStoredProjects(): Promise<ProjectSummary[]> {
  await flushProjectSave();
  const list = await listProjects(idb);
  list.forEach((s) => stored.add(s.id));
  return list;
}

export async function deleteStoredProject(id: string): Promise<void> {
  if (useProjectStore.getState().projectId === id) {
    saveLater.cancel();
    useEditorStore.getState().reset();
    useProjectStore.getState().closeProject();
  }
  stored.delete(id);
  lastSaved.delete(id);
  await enqueue(() => deleteProject(idb, id));
}

/**
 * 開いているプロジェクトを、変わるたびに IndexedDB に保存する（文章の入力などは 500ms 待ってまとめる）。
 * 起動時に前の版の自動保存のデータがあれば、1 つのプロジェクトとして引き継ぐ。AppShell で 1 回だけ使う
 */
export function useProjectPersistence(): void {
  useEffect(() => {
    void enqueue(async () => {
      const id = await migrateLegacyAutosave(idb);
      if (id) stored.add(id);
    }, false);
    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      // いつ保存するかは lib/projects/saving.ts（ほかのタブで編集しているプロジェクトは、古い内容で上書きしないよう保存しない）
      const timing = saveTiming(state, prev, canEditInThisTab());
      if (timing === "none" || !state.projectId) return;
      if (timing === "now") {
        saveLater.cancel();
        void save(state.projectId, state.project, state.dirty);
      } else {
        saveLater(state.projectId, state.project, state.dirty);
      }
    });
    const onHide = () => saveLater.flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      unsubscribe();
      saveLater.flush();
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
}

/** プロジェクトを開き、最初の未作成の文字を編集中にする */
function openLoaded(project: Project, id: string, dirty: boolean) {
  useEditorStore.getState().reset();
  const store = useProjectStore.getState();
  store.loadProject(project, { id, dirty });
  store.setCurrentChar(nextUncreated(project.queue, project.glyphs, null));
}

export type ProjectUrlState = "ready" | "loading" | "invalid";

/**
 * URL の ?uuid= のプロジェクトを開く（入力ページ・プレビューで使う。Suspense の中で使う）
 * - uuid がない：開いているプロジェクトがあればその uuid、なければ新しいプロジェクトを作って URL に付ける
 * - 保存してあれば読み込む。保存していない（文字を追加する前にリロードしたなど）なら、その uuid で新しく始める
 * - uuid の形が正しくなければ invalid
 */
export function useProjectFromUrl(): ProjectUrlState {
  const uuid = useSearchParams().get("uuid");
  const projectId = useProjectStore((s) => s.projectId);
  const router = useRouter();
  const pathname = usePathname();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) {
      const store = useProjectStore.getState();
      const id = store.projectId ?? store.newProject();
      router.replace(`${pathname}?uuid=${id}`);
      return;
    }
    if (uuid === useProjectStore.getState().projectId || !isProjectId(uuid)) return;
    let cancelled = false;
    void flushProjectSave()
      .then(() => loadProject(idb, uuid))
      .then((loaded) => {
        if (cancelled || uuid === useProjectStore.getState().projectId) return;
        if (loaded) {
          stored.add(uuid);
          lastSaved.set(uuid, loaded.project);
          openLoaded(loaded.project, uuid, loaded.dirty);
        } else {
          useEditorStore.getState().reset();
          useProjectStore.getState().newProject(undefined, uuid);
          // 削除したプロジェクトのブックマークを開いたときなど。黙って空のプロジェクトにしない
          notify(
            "このプロジェクトはこのブラウザに保存されていないので、新しいプロジェクトとして始めます",
          );
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(uuid);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, pathname, router]);

  if (uuid && (!isProjectId(uuid) || failed === uuid)) return "invalid";
  return uuid && uuid === projectId ? "ready" : "loading";
}

/** 保存されている最新の内容でプロジェクトを開き直す（ほかのタブから編集を引き継いだとき） */
export async function reloadProject(id: string): Promise<void> {
  await flushProjectSave();
  const loaded = await loadProject(idb, id);
  if (!loaded) return;
  stored.add(id);
  lastSaved.set(id, loaded.project);
  openLoaded(loaded.project, id, loaded.dirty);
}

/** zip から読み込んだプロジェクトを、新しい ID のプロジェクトとして開いて保存する */
export async function openAsNewProject(project: Project): Promise<string> {
  await flushProjectSave();
  const id = createProjectId();
  openLoaded(project, id, false);
  await saveCurrentProjectNow();
  return id;
}
