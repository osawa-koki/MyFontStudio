// 重い処理の本体（Web Worker で動かす。Worker が使えない環境では画面のスレッドで同じものを動かす）。
// React・DOM に依存させない（PNG は OffscreenCanvas で描く）
import { readArchive, buildArchive, type ReadResult } from "../lib/archive/archive";
import { buildFont, type FontFormat } from "../lib/font/build";
import { getGlyphOutline } from "../lib/glyph/outline";
import type { GlyphOutline } from "../lib/glyph/types";
import type { FontSettings, Project } from "../types/project";

export interface Progress {
  label: string;
  done: number;
  total: number;
}

export type Task =
  | { kind: "buildFont"; format: FontFormat; outlines: GlyphOutline[]; font: FontSettings }
  | {
      kind: "saveZip";
      project: Project;
      savedAt: string;
      exportCount: number;
      /** PNG を描く関数（描けない環境では渡さない。PNG なしの zip になる） */
      withPreviews: boolean;
    }
  | { kind: "readZip"; buffer: ArrayBuffer };

export type TaskResult<T extends Task> = T extends { kind: "buildFont" }
  ? ArrayBuffer | null
  : T extends { kind: "saveZip" }
    ? Uint8Array
    : ReadResult;

export interface TaskOptions {
  onProgress?: (p: Progress) => void;
  renderPng?: (glyph: Project["glyphs"][string]) => Promise<Uint8Array>;
}

/** 進み具合は、およそ 1% ごとにだけ知らせる（メッセージを送りすぎない） */
function progressReporter(label: string, total: number, onProgress?: (p: Progress) => void) {
  let last = -1;
  return (done: number) => {
    const step = Math.floor((done / Math.max(1, total)) * 100);
    if (step !== last || done === total) {
      last = step;
      onProgress?.({ label, done, total });
    }
  };
}

export async function runTask<T extends Task>(
  task: T,
  options: TaskOptions = {},
): Promise<TaskResult<T>> {
  const { onProgress } = options;
  if (task.kind === "buildFont") {
    return buildFont(task.format, task.outlines, task.font) as TaskResult<T>;
  }
  if (task.kind === "readZip") {
    onProgress?.({ label: "zip を読み込んでいます", done: 0, total: 0 });
    return (await readArchive(task.buffer)) as TaskResult<T>;
  }
  // zip の保存：輪郭 → フォント → PNG → 圧縮
  const { project } = task;
  const created = Object.values(project.glyphs).filter((g) => g.strokes.length > 0);
  const order = new Map(project.queue.map((c, i) => [c, i]));
  created.sort((a, b) => (order.get(a.char) ?? Infinity) - (order.get(b.char) ?? Infinity));

  const reportOutline = progressReporter("輪郭を計算しています", created.length, onProgress);
  const outlines: GlyphOutline[] = [];
  created.forEach((g, i) => {
    const o = getGlyphOutline(g);
    if (o.contours.length > 0) outlines.push(o);
    reportOutline(i + 1);
  });

  let ttf: ArrayBuffer | null = null;
  let otf: ArrayBuffer | null = null;
  if (outlines.length > 0) {
    onProgress?.({ label: "フォントを作っています", done: 0, total: 0 });
    const font = { ...project.font, exportCount: task.exportCount };
    ttf = buildFont("ttf", outlines, font);
    otf = buildFont("otf", outlines, font);
  }

  const previews = new Map<string, Uint8Array>();
  if (task.withPreviews && options.renderPng) {
    const reportPng = progressReporter("プレビュー画像を作っています", created.length, onProgress);
    for (let i = 0; i < created.length; i++) {
      previews.set(created[i]!.char, await options.renderPng(created[i]!));
      reportPng(i + 1);
    }
  }
  onProgress?.({ label: "圧縮しています", done: 0, total: 0 });
  return (await buildArchive({
    project: { ...project, font: { ...project.font, exportCount: task.exportCount } },
    savedAt: task.savedAt,
    ttf,
    otf,
    previews,
  })) as TaskResult<T>;
}
