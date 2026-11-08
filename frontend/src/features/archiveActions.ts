import { ArchiveError, archiveFileName, buildArchive, readArchive } from "../lib/archive/archive";
import { downloadBlob } from "../lib/download";
import { collectOutlines } from "../lib/font/outlines";
import { isoWithOffset } from "../lib/project/chars";
import { openAsNewProject } from "./projects";
import { useProjectStore } from "../store/projectStore";
import { askDialog, notify } from "../store/uiStore";
import { commitDraft } from "./glyphActions";
import { renderGlyphPng } from "./png";
import { unsavedDraftChars } from "./unsavedWarning";

/** 読み込める zip の大きさの上限（圧縮後） */
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/** 「zip で保存」（仕様 7.4）。描きかけの文字があれば、先に保存するか確かめる */
export async function saveZip(): Promise<void> {
  const drafts = unsavedDraftChars();
  if (drafts.length > 0) {
    const { value } = await askDialog({
      title: "この文字も保存しますか？",
      message: `グリフとして保存していない描きかけの線があります：${drafts.join(" ")}（描いた履歴は保存しないを選んでも zip に入ります）`,
      buttons: [
        { label: "キャンセル", value: "cancel" },
        { label: "保存しない", value: "skip" },
        { label: "保存する", value: "save", variant: "primary" },
      ],
      cancelValue: "cancel",
    });
    if (value === "cancel") return;
    if (value === "save") drafts.forEach(commitDraft);
  }

  const store = useProjectStore.getState();
  const exportCount = store.incrementExportCount();
  const project = useProjectStore.getState().project;
  try {
    const outlines = collectOutlines(project);
    let ttf: ArrayBuffer | null = null;
    let otf: ArrayBuffer | null = null;
    if (outlines.length > 0) {
      const { buildFont } = await import("../lib/font/build");
      const font = { ...project.font, exportCount };
      ttf = buildFont("ttf", outlines, font);
      otf = buildFont("otf", outlines, font);
    }
    const previews = new Map<string, Uint8Array>();
    for (const glyph of Object.values(project.glyphs)) {
      if (glyph.strokes.length > 0) previews.set(glyph.char, await renderGlyphPng(glyph));
    }
    const now = new Date();
    const zip = await buildArchive({ project, savedAt: isoWithOffset(now), ttf, otf, previews });
    downloadBlob(
      new Blob([zip as BlobPart], { type: "application/zip" }),
      archiveFileName(project.font.familyName, now),
    );
    useProjectStore.getState().markSaved();
    notify("zip に保存しました", "success");
  } catch (e) {
    console.error(e);
    notify(`zip に保存できませんでした：${e instanceof Error ? e.message : String(e)}`, "error");
  }
}

/**
 * zip を読み込んで、新しいプロジェクトとして開く（仕様 7.5。今開いているプロジェクトは上書きしない）。
 * 成功したら新しいプロジェクトの ID（呼び出し側で入力ページに移動する）
 */
export async function openZip(file: File): Promise<string | null> {
  if (file.size > MAX_ZIP_BYTES) {
    notify("ファイルが大きすぎます（200MB まで）", "error");
    return null;
  }
  try {
    const { project, skipped } = await readArchive(await file.arrayBuffer());
    const id = await openAsNewProject(project);
    if (skipped.length > 0) {
      notify(
        `${skipped.length} 文字を読み込めませんでした`,
        "error",
        skipped.map((s) => `「${s.char}」：${s.reason}`),
      );
    } else {
      notify(`「${file.name}」を新しいプロジェクトとして読み込みました`, "success");
    }
    return id;
  } catch (e) {
    const message = e instanceof ArchiveError ? e.message : "zip ファイルを読み込めませんでした";
    if (!(e instanceof ArchiveError)) console.error(e);
    notify(`「${file.name}」を開けませんでした：${message}`, "error");
    return null;
  }
}
