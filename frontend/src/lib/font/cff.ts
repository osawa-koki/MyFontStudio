// CFF（.otf のアウトライン）の Top DICT の FontBBox を書き換える最小限の処理。
// opentype.js は FontBBox を [0, yMin（.notdef を除く）, ascender, advanceWidthMax] で固定して書き、外から変えられないため。
// Top DICT の長さが変わると、そのあとのデータ（charset・Encoding・CharStrings・Private）の位置がずれるので、
// それらの位置を指す値も直す。数値は 5 バイトの整数（29）で書き、長さを決まった形にする

type Operand = number;
interface DictEntry {
  op: number; // 2 バイトの演算子（12 xx）は 1200 + xx
  operands: Operand[];
}

const OP_FONT_BBOX = 5;
const OP_CHARSET = 15;
const OP_ENCODING = 16;
const OP_CHARSTRINGS = 17;
const OP_PRIVATE = 18;

function readIndex(data: Uint8Array, pos: number): { items: Uint8Array[]; end: number } {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = v.getUint16(pos);
  if (count === 0) return { items: [], end: pos + 2 };
  const offSize = data[pos + 2]!;
  const readOff = (i: number) => {
    let o = 0;
    for (let k = 0; k < offSize; k++) o = o * 256 + data[pos + 3 + i * offSize + k]!;
    return o;
  };
  const dataStart = pos + 3 + (count + 1) * offSize - 1;
  const items: Uint8Array[] = [];
  for (let i = 0; i < count; i++)
    items.push(data.slice(dataStart + readOff(i), dataStart + readOff(i + 1)));
  return { items, end: dataStart + readOff(count) };
}

function writeIndex(items: readonly Uint8Array[]): Uint8Array {
  const total = items.reduce((n, it) => n + it.length, 0) + 1;
  const offSize = total < 0x100 ? 1 : total < 0x10000 ? 2 : total < 0x1000000 ? 3 : 4;
  const out = new Uint8Array(3 + (items.length + 1) * offSize + total - 1);
  new DataView(out.buffer).setUint16(0, items.length);
  out[2] = offSize;
  let off = 1;
  const writeOff = (i: number, value: number) => {
    for (let k = offSize - 1; k >= 0; k--) {
      out[3 + i * offSize + k] = value & 0xff;
      value = Math.floor(value / 256);
    }
  };
  let p = 3 + (items.length + 1) * offSize;
  items.forEach((it, i) => {
    writeOff(i, off);
    out.set(it, p);
    p += it.length;
    off += it.length;
  });
  writeOff(items.length, off);
  return out;
}

/** 実数（30）の読み取り */
function readReal(data: Uint8Array, pos: number): { value: number; end: number } {
  let s = "";
  const map = "0123456789.EE?-";
  for (;;) {
    const b = data[pos++]!;
    for (const n of [b >> 4, b & 0xf]) {
      if (n === 0xf) return { value: parseFloat(s), end: pos };
      if (n === 0xc) s += "E-";
      else s += map[n];
    }
  }
}

export function parseDict(data: Uint8Array): DictEntry[] {
  const entries: DictEntry[] = [];
  let operands: Operand[] = [];
  let p = 0;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  while (p < data.length) {
    const b0 = data[p]!;
    if (b0 <= 21) {
      const op = b0 === 12 ? 1200 + data[p + 1]! : b0;
      p += b0 === 12 ? 2 : 1;
      entries.push({ op, operands });
      operands = [];
    } else if (b0 === 28) {
      operands.push(v.getInt16(p + 1));
      p += 3;
    } else if (b0 === 29) {
      operands.push(v.getInt32(p + 1));
      p += 5;
    } else if (b0 === 30) {
      const r = readReal(data, p + 1);
      operands.push(r.value);
      p = r.end;
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139);
      p += 1;
    } else if (b0 >= 247 && b0 <= 250) {
      operands.push((b0 - 247) * 256 + data[p + 1]! + 108);
      p += 2;
    } else if (b0 >= 251 && b0 <= 254) {
      operands.push(-(b0 - 251) * 256 - data[p + 1]! - 108);
      p += 2;
    } else {
      throw new Error(`CFF の DICT が読めない（${b0}）`);
    }
  }
  return entries;
}

function encodeNumber(n: number): number[] {
  if (Number.isInteger(n)) {
    // 位置を表す値の長さが変わらないよう、整数は 5 バイトで書く
    const b = new Uint8Array(5);
    b[0] = 29;
    new DataView(b.buffer).setInt32(1, n);
    return [...b];
  }
  // 実数（FontMatrix など）
  const s = n.toExponential().replace("e+", "E").replace("e-", "E-");
  const nibbles: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c >= "0" && c <= "9") nibbles.push(Number(c));
    else if (c === ".") nibbles.push(0xa);
    else if (c === "-" && s[i - 1] === "E") nibbles.splice(nibbles.length - 1, 1, 0xc);
    else if (c === "E") nibbles.push(0xb);
    else if (c === "-") nibbles.push(0xe);
  }
  nibbles.push(0xf);
  if (nibbles.length % 2) nibbles.push(0xf);
  const out = [30];
  for (let i = 0; i < nibbles.length; i += 2) out.push((nibbles[i]! << 4) | nibbles[i + 1]!);
  return out;
}

export function encodeDict(entries: readonly DictEntry[]): Uint8Array {
  const out: number[] = [];
  for (const e of entries) {
    for (const o of e.operands) out.push(...encodeNumber(o));
    if (e.op >= 1200) out.push(12, e.op - 1200);
    else out.push(e.op);
  }
  return Uint8Array.from(out);
}

/** CFF テーブルの FontBBox を書き換えた新しい CFF テーブルを返す */
export function setCffFontBBox(
  cff: Uint8Array,
  bbox: { xMin: number; yMin: number; xMax: number; yMax: number },
): Uint8Array {
  const hdrSize = cff[2]!;
  const nameIndex = readIndex(cff, hdrSize);
  const topIndex = readIndex(cff, nameIndex.end);
  const oldTop = topIndex.items[0];
  if (!oldTop || topIndex.items.length !== 1) throw new Error("CFF の Top DICT が 1 つではない");
  const entries = parseDict(oldTop);

  // いったん今の値で書いて長さを決め、ずれ（delta）を求めてから、位置を表す値を直す
  const withBBox = entries.filter((e) => e.op !== OP_FONT_BBOX);
  withBBox.unshift({
    op: OP_FONT_BBOX,
    operands: [bbox.xMin, bbox.yMin, bbox.xMax, bbox.yMax].map(Math.round),
  });
  const newIndex = writeIndex([encodeDict(withBBox)]);
  const delta = newIndex.length - (topIndex.end - nameIndex.end);
  const shifted = withBBox.map((e) => {
    if (e.op === OP_CHARSET || e.op === OP_CHARSTRINGS)
      return { ...e, operands: [e.operands[0]! + delta] };
    // Encoding の 0・1 は標準のエンコーディング（位置ではない）
    if (e.op === OP_ENCODING && e.operands[0]! > 1)
      return { ...e, operands: [e.operands[0]! + delta] };
    if (e.op === OP_PRIVATE) return { ...e, operands: [e.operands[0]!, e.operands[1]! + delta] };
    return e;
  });
  const finalIndex = writeIndex([encodeDict(shifted)]);
  if (finalIndex.length !== newIndex.length) throw new Error("CFF の Top DICT の長さが変わった");

  const out = new Uint8Array(cff.length + delta);
  out.set(cff.subarray(0, nameIndex.end), 0);
  out.set(finalIndex, nameIndex.end);
  out.set(cff.subarray(topIndex.end), nameIndex.end + finalIndex.length);
  return out;
}
