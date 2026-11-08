import { useEffect } from "react";
import { collectOutlinesAsync } from "../lib/font/outlines";
import { registerPreviewFont, unregisterPreviewFont } from "../lib/font/fontface";
import { useFontStore } from "../store/fontStore";
import { useProjectStore } from "../store/projectStore";
import { TaskCancelledError, runInWorker } from "./worker";

/** グリフを保存・削除してから、フォントを作り直すまでの待ち時間 */
export const REBUILD_DELAY_MS = 300;

let generation = 0;

/** プレビュー用の .ttf を作り、FontFace に登録する。輪郭はグリフ単位でキャッシュしているので、変わったグリフだけ計算し直す */
export async function rebuildPreviewFont(): Promise<void> {
  const my = ++generation;
  const { project } = useProjectStore.getState();
  const set = useFontStore.getState().set;
  try {
    // キャッシュのない輪郭（zip の読み込み直後など）をたくさん計算しても画面を止めないよう、区切って計算する
    const outlines = await collectOutlinesAsync(project, { cancelled: () => my !== generation });
    if (!outlines) return;
    if (outlines.length === 0) {
      unregisterPreviewFont();
      set({ family: null, outlineCount: 0, chars: new Set(), error: null });
      return;
    }
    // フォントの生成は Web Worker で行う（画面を止めない）
    const buffer = await runInWorker({
      kind: "buildFont",
      format: "ttf",
      outlines,
      font: project.font,
    });
    if (!buffer || my !== generation) return;
    const family = await registerPreviewFont(buffer);
    // 待っている間に次の生成が始まっていたら、そちらに任せる
    if (my !== generation) return;
    set({
      family,
      outlineCount: outlines.length,
      chars: new Set(outlines.map((o) => o.char)),
      error: null,
    });
  } catch (e) {
    // zip の保存などを取り消して Worker を止めたときは、この生成も止まるので、やり直す（新しい生成が始まっていなければ）
    if (e instanceof TaskCancelledError) {
      if (my === generation) window.setTimeout(() => void rebuildPreviewFont(), 0);
      return;
    }
    console.error("フォントの生成に失敗しました", e);
    if (my === generation) set({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** グリフ（とフォント名）が変わったら、少し待ってからフォントを作り直す。Layout で 1 回だけ使う */
export function useFontPreview(): void {
  const glyphs = useProjectStore((s) => s.project.glyphs);
  const familyName = useProjectStore((s) => s.project.font.familyName);
  useEffect(() => {
    const timer = window.setTimeout(() => void rebuildPreviewFont(), REBUILD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [glyphs, familyName]);
}
