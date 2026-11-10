import { ArchiveError, archiveFileName } from "../lib/archive/common";
import { downloadBlob } from "../lib/download";
import { isoWithOffset } from "../lib/project/chars";
import { openAsNewProject } from "./projects";
import { useProjectStore } from "../store/projectStore";
import { LOCKED_OUT_MESSAGE, isLockedOut } from "../store/tabLockStore";
import { askDialog, notify } from "../store/uiStore";
import { commitDraft } from "./glyphActions";
import { TaskCancelledError, runInWorker } from "./worker";
import { unsavedDraftChars } from "./unsavedWarning";

/** 読み込める zip の大きさの上限（圧縮後） */
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/** zip の保存が動いているか（ボタンとショートカットから重ねて動かさない） */
let savingZip = false;

/** 「zip で保存」（仕様 7.4）。描きかけの文字があれば、先に保存するか確かめる。保存の途中なら何もしない */
export async function saveZip(): Promise<void> {
  // ほかのタブで編集しているときは、このタブの古い内容で書き出さない
  if (isLockedOut()) {
    notify(LOCKED_OUT_MESSAGE);
    return;
  }
  if (savingZip) {
    notify("zip に保存しています。終わるまでお待ちください");
    return;
  }
  savingZip = true;
  try {
    await saveZipOnce();
  } finally {
    savingZip = false;
  }
}

async function saveZipOnce(): Promise<void> {
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

  // zip に入れるのは、この時点の内容。書き出し回数は保存できてから加算する
  const { project, revision } = useProjectStore.getState();
  const exportCount = project.font.exportCount + 1;
  try {
    // 輪郭・フォント・PNG・圧縮は Web Worker で行い、進み具合を出す
    const now = new Date();
    const zip = await runInWorker(
      { kind: "saveZip", project, savedAt: isoWithOffset(now), exportCount, withPreviews: true },
      { label: "zip に保存しています" },
    );
    downloadBlob(
      new Blob([zip as BlobPart], { type: "application/zip" }),
      archiveFileName(project.font.familyName, now),
    );
    const store = useProjectStore.getState();
    store.recordExport(exportCount);
    // 保存の途中に変えた内容は zip に入っていないので、「zip 未保存」を残す
    store.markSaved(revision);
    // ブラウザの保存のダイアログで取り消されても、ページからは分からない（<a download> では検出できない）
    notify(
      "zip をダウンロードしました（保存を取り消したときは、もう一度「zip で保存」してください）",
      "success",
    );
  } catch (e) {
    if (e instanceof TaskCancelledError) {
      notify("zip の保存を取り消しました");
      return;
    }
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
    const buffer = await file.arrayBuffer();
    // 展開と検証は Web Worker で行う（バッファは複製せずに渡す）
    const { project, skipped } = await runInWorker(
      { kind: "readZip", buffer },
      { label: "zip を読み込んでいます", transfer: [buffer] },
    );
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
    if (e instanceof TaskCancelledError) {
      notify("zip の読み込みを取り消しました");
      return null;
    }
    const message = e instanceof ArchiveError ? e.message : "zip ファイルを読み込めませんでした";
    if (!(e instanceof ArchiveError)) console.error(e);
    notify(`「${file.name}」を開けませんでした：${message}`, "error");
    return null;
  }
}
