/** Blob を <a download> でダウンロードさせる */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐに消すとダウンロードが始まらないブラウザがあるので、少し待つ
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
