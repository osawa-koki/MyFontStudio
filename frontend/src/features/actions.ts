import { downloadBlob } from "../lib/download";
import type { FontFormat } from "../lib/font/build";
import { collectOutlines } from "../lib/font/outlines";
import { notify } from "../store/uiStore";
import { useProjectStore } from "../store/projectStore";

const MIME: Record<FontFormat, string> = { ttf: "font/ttf", otf: "font/otf" };

/** フォントを書き出してダウンロードさせる。書き出し回数を 1 加算する（バージョンに入る） */
export async function downloadFont(format: FontFormat): Promise<void> {
  const store = useProjectStore.getState();
  const outlines = collectOutlines(store.project);
  if (outlines.length === 0) {
    notify("まだ文字がありません。入力ページで文字を作成してください", "error");
    return;
  }
  const exportCount = store.incrementExportCount();
  const { font } = useProjectStore.getState().project;
  try {
    const { buildFont } = await import("../lib/font/build");
    const buffer = buildFont(format, outlines, { ...font, exportCount })!;
    downloadBlob(new Blob([buffer], { type: MIME[format] }), `${font.familyName}.${format}`);
  } catch (e) {
    console.error(e);
    notify(`フォントを作れませんでした：${e instanceof Error ? e.message : String(e)}`, "error");
  }
}
