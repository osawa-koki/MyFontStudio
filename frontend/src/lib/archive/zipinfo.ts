// zip を展開する前に、中央ディレクトリからファイルの一覧と展開後のサイズを読む（zip bomb 対策）

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** zip の中央ディレクトリを読む。zip でなければ（または ZIP64 なら）例外 */
export function readZipEntries(buffer: ArrayBuffer): ZipEntryInfo[] {
  const view = new DataView(buffer);
  const len = buffer.byteLength;
  // 末尾の EOCD を探す（コメントは最大 65535 バイト）
  let eocd = -1;
  for (let i = len - 22; i >= Math.max(0, len - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip ファイルではありません");
  const count = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff)
    throw new Error("この zip の形式（ZIP64）には対応していません");
  const decoder = new TextDecoder();
  const entries: ZipEntryInfo[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > len || view.getUint32(p, true) !== CENTRAL_SIGNATURE) {
      throw new Error("zip ファイルが壊れています");
    }
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    if (p + 46 + nameLength > len) throw new Error("zip ファイルが壊れています");
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLength));
    entries.push({ name, compressedSize, uncompressedSize });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
