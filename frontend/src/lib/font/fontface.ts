/** FontFace の登録先（document.fonts）。テストで差し替えられるようにする */
export interface FontFaceHost {
  FontFace: new (family: string, source: ArrayBuffer) => FontFace;
  fonts: { add(face: FontFace): unknown; delete(face: FontFace): unknown };
}

let counter = 0;
/** 今登録しているもの。n は登録を始めた順番 */
let current: { face: FontFace; family: string; n: number } | null = null;

function defaultHost(): FontFaceHost | null {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return null;
  return { FontFace, fonts: document.fonts };
}

/**
 * 生成した .ttf をプレビュー用に登録し、CSS で使うファミリー名を返す。
 * キャッシュされないよう名前は登録のたびに変え（hw-preview-{n}）、前の FontFace は消す。
 * 読み込みを待っている間に、あとから始めた登録が先に終わったら、こちらは登録せずに null を返す
 * （古いフォントで新しいフォントを消さないように）
 */
export async function registerPreviewFont(
  buffer: ArrayBuffer,
  host: FontFaceHost | null = defaultHost(),
): Promise<string | null> {
  if (!host) return null;
  const n = ++counter;
  const family = `hw-preview-${n}`;
  const face = new host.FontFace(family, buffer);
  await face.load();
  if (current && current.n > n) return null;
  host.fonts.add(face);
  const prev = current;
  current = { face, family, n };
  if (prev) host.fonts.delete(prev.face);
  return family;
}

/** 登録したプレビュー用のフォントを消す（グリフが 0 個になったとき） */
export function unregisterPreviewFont(host: FontFaceHost | null = defaultHost()): void {
  if (current && host) host.fonts.delete(current.face);
  current = null;
}
