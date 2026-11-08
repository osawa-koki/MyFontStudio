// zip の処理のうち、JSZip に依存しない部分（画面のスレッドから使う）。
// JSZip と、それが使う Node の互換コード（読み込んだ時点で new Function を試すものがあり、CSP の違反になる）を
// 画面のバンドルに入れないよう、archive.ts から分ける。zip の組み立て・展開は Web Worker で行う

/** zip が読み込めないときのエラー（利用者に見せる文言を持つ） */
export class ArchiveError extends Error {}

/** {familyName}_{YYYYMMDD-HHmm}.zip */
export function archiveFileName(familyName: string, date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${familyName}_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.zip`;
}
