import type { Ring, Vec } from "./types";

/** 符号付き面積（y 上向きで反時計回りが正。y 下向きの座標では時計回りが正になる） */
export function signedArea(ring: readonly Vec[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** 先頭と同じ末尾の点、連続する同じ点を取り除く */
export function normalizeRing(ring: readonly Vec[]): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push([p[0], p[1]]);
  }
  while (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) break;
    out.pop();
  }
  return out;
}

function perpendicularDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** 開いた折れ線の Douglas–Peucker（両端は残す）。再帰の深さを避けるためスタックで処理する */
export function simplifyPolyline(points: readonly Vec[], tolerance: number): Vec[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i]!, points[start]!, points[end]!);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** 閉じた多角形の Douglas–Peucker。先頭の点と、そこから最も遠い点で 2 つに分けて処理する */
export function simplifyRing(ring: readonly Vec[], tolerance: number): Ring {
  if (ring.length <= 4) return ring.slice();
  const first = ring[0]!;
  let far = 1;
  let farDist = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i]![0] - first[0], ring[i]![1] - first[1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const a = simplifyPolyline(ring.slice(0, far + 1), tolerance);
  const b = simplifyPolyline([...ring.slice(far), first], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
