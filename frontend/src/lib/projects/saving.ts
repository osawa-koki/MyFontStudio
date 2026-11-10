import type { Project } from "../../types/project";

export interface SaveState {
  projectId: string | null;
  project: Project;
  dirty: boolean;
}

/**
 * ストアが変わったときに、開いているプロジェクトをいつ保存するか
 * - none：保存しない（プロジェクトを開いていない・ほかのタブで編集している・切り替えただけ・変わっていない）
 * - now：すぐ保存する（文字の追加・グリフの保存・描いた線・フォントの設定。すぐにリロードされても消えないように）
 * - later：少し待ってまとめて保存する（プレビューの文章、ペンの設定（太さのスライダーはドラッグ中に何度も変わる）など頻繁に変わるもの）
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
    p.font !== q.font
  ) {
    return "now";
  }
  return "later";
}

/** ブラウザの容量が足りないための失敗か（IndexedDB は QuotaExceededError で失敗する） */
export function isQuotaError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && (e as { name?: unknown }).name === "QuotaExceededError"
  );
}

/** ブラウザに保存できなかったときに出す文言 */
export function saveFailedMessage(quota: boolean): string {
  return quota
    ? "ブラウザの容量が足りないため、作業を保存できませんでした。「zip で保存」してから、使い方ページで不要なプロジェクトを削除してください"
    : "ブラウザに作業を保存できませんでした（プライベートブラウズなどでは保存できません）。作業を失わないよう「zip で保存」してください";
}
