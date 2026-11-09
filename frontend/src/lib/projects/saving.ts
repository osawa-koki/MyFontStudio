import type { Project } from "../../types/project";

export interface SaveState {
  projectId: string | null;
  project: Project;
  dirty: boolean;
}

/**
 * ストアが変わったときに、開いているプロジェクトをいつ保存するか
 * - none：保存しない（プロジェクトを開いていない・ほかのタブで編集している・切り替えただけ・変わっていない）
 * - now：すぐ保存する（文字の追加・グリフの保存・描いた線・設定の変更。すぐにリロードされても消えないように）
 * - later：少し待ってまとめて保存する（プレビューの文章など頻繁に変わるもの）
 */
export function saveTiming(
  next: SaveState,
  prev: SaveState,
  canEdit: boolean,
): "none" | "now" | "later" {
  if (!next.projectId || !canEdit) return "none";
  // 切り替えただけ（読み込んだ直後）は保存しない
  if (next.projectId !== prev.projectId) return "none";
  const p = next.project;
  const q = prev.project;
  if (p === q && next.dirty === prev.dirty) return "none";
  if (
    p.queue !== q.queue ||
    p.glyphs !== q.glyphs ||
    p.drawings !== q.drawings ||
    p.font !== q.font ||
    p.defaults !== q.defaults
  ) {
    return "now";
  }
  return "later";
}
