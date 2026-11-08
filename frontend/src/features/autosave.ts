import { del, get, set } from "idb-keyval";
import { useEffect } from "react";
import {
  AUTOSAVE_DELAY_MS,
  clearSnapshot,
  debounce,
  hasContent,
  loadSnapshot,
  saveSnapshot,
  type KeyValueStore,
} from "../lib/autosave/autosave";
import { nextUncreated } from "../lib/project/chars";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { askDialog, notify } from "../store/uiStore";

/** IndexedDB（idb-keyval）。プライベートブラウズなどで使えないときは何もしない */
const idb: KeyValueStore = { get, set, del };

/**
 * リロード対策の自動保存（仕様 3 章）。起動時に前回の作業があれば復元するか確かめ、
 * その後はストアが変わるたびに 500ms 待って IndexedDB に保存する。AppShell で 1 回だけ使う
 */
export function useAutosave(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    const save = debounce(() => {
      const { project, dirty, started } = useProjectStore.getState();
      if (!started) return;
      saveSnapshot(idb, project, dirty).catch((e) => console.warn("自動保存に失敗しました", e));
    }, AUTOSAVE_DELAY_MS);

    void (async () => {
      const snapshot = await loadSnapshot(idb);
      if (disposed) return;
      if (snapshot && hasContent(snapshot.project) && !useProjectStore.getState().started) {
        const saved = new Date(snapshot.savedAt).toLocaleString("ja-JP");
        const { value } = await askDialog({
          title: "前回の作業を復元しますか？",
          message: `${saved} に自動保存した「${snapshot.project.font.familyName}」（${snapshot.project.queue.length} 文字）があります。復元しないと、自動保存したデータは消えます。`,
          buttons: [
            { label: "復元しない", value: "discard", variant: "danger" },
            { label: "復元する", value: "restore", variant: "primary" },
          ],
          cancelValue: "later",
        });
        if (disposed) return;
        if (value === "restore") {
          const store = useProjectStore.getState();
          useEditorStore.getState().reset();
          store.loadProject(snapshot.project, { dirty: snapshot.dirty });
          store.setCurrentChar(
            nextUncreated(snapshot.project.queue, snapshot.project.glyphs, null),
          );
          notify("前回の作業を復元しました", "success");
        } else if (value === "discard") {
          await clearSnapshot(idb).catch(() => {});
        }
      }
      // 復元するか決まってから保存を始める（決まる前に上書きしない）
      unsubscribe = useProjectStore.subscribe((state, prev) => {
        if (state.project !== prev.project || state.dirty !== prev.dirty) save();
      });
      if (useProjectStore.getState().started) save();
    })();

    // タブを閉じる前に、待っている保存を済ませる
    const onHide = () => save.flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      disposed = true;
      unsubscribe();
      save.flush();
      window.removeEventListener("pagehide", onHide);
    };
  }, []);
}
