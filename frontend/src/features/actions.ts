import { downloadBlob } from "../lib/download";
import type { FontFormat } from "../lib/font/build";
import { collectOutlinesAsync } from "../lib/font/outlines";
import { LOCKED_OUT_MESSAGE, isLockedOut } from "../store/tabLockStore";
import { notify } from "../store/uiStore";
import { confirmCommitDrafts } from "./draftPrompt";
import { TaskBusyError, TaskCancelledError, runInWorker } from "./worker";
import { useProjectStore } from "../store/projectStore";

const MIME: Record<FontFormat, string> = { ttf: "font/ttf", otf: "font/otf" };

/**
 * フォントを書き出してダウンロードさせる。書き出し回数を 1 加算する（バージョンに入る）。
 * 描きかけの文字があれば、先に保存するか確かめる（保存しないとフォントに入らない）
 */
export async function downloadFont(format: FontFormat): Promise<void> {
  // ほかのタブで編集しているときは、このタブの古い内容で書き出さない
  if (isLockedOut()) {
    notify(LOCKED_OUT_MESSAGE);
    return;
  }
  if (!(await confirmCommitDrafts("保存しない文字は、フォントに入りません"))) return;
  const store = useProjectStore.getState();
  const outlines = (await collectOutlinesAsync(store.project)) ?? [];
  if (outlines.length === 0) {
    notify("まだ文字がありません。入力ページで文字を作成してください", "error");
    return;
  }
  // 書き出し回数は、書き出せてから加算する（取り消し・失敗では増やさない）
  const { font } = store.project;
  const exportCount = font.exportCount + 1;
  try {
    // フォントの生成は Web Worker で行う
    const buffer = (await runInWorker(
      { kind: "buildFont", format, outlines, font: { ...font, exportCount } },
      { label: "フォントを作っています" },
    ))!;
    downloadBlob(new Blob([buffer], { type: MIME[format] }), `${font.familyName}.${format}`);
    useProjectStore.getState().recordExport(exportCount);
  } catch (e) {
    if (e instanceof TaskCancelledError) return;
    if (e instanceof TaskBusyError) {
      notify(e.message);
      return;
    }
    console.error(e);
    notify(`フォントを作れませんでした：${e instanceof Error ? e.message : String(e)}`, "error");
  }
}
