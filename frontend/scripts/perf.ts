// 性能の確認（仕様 10.1）：グリフ保存からプレビュー反映まで、300 文字で 0.5 秒・2,000 文字で 2 秒以内。
// ダミーの手書きデータ（1 文字 6 本・各 40 点ほど）で、輪郭の計算とフォントの生成にかかる時間を測る。
// 使い方：npm run perf
import { buildFont, collectOutlines } from "../src/lib/font/build";
import { createEmptyProject } from "../src/lib/project/project";
import type { GlyphData, Stroke } from "../src/types/project";

function rand(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

function dummyGlyph(char: string, seed: number): GlyphData {
  const r = rand(seed);
  const strokes: Stroke[] = Array.from({ length: 6 }, () => {
    const x0 = 100 + r() * 800;
    const y0 = 100 + r() * 800;
    const dx = (r() - 0.5) * 30;
    const dy = (r() - 0.5) * 30;
    return {
      points: Array.from({ length: 40 }, (_, i) => [
        Math.round((x0 + dx * i + Math.sin(i / 3) * 5) * 10) / 10,
        Math.round((y0 + dy * i) * 10) / 10,
        0.3 + 0.4 * r(),
      ]) as [number, number, number][],
      simulatePressure: false,
    };
  });
  return {
    char,
    codepoint: "U+" + char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
    canvasSize: 1000,
    widthMode: "auto",
    pen: { size: 40, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false },
    strokes,
    updatedAt: "",
  };
}

function measure(count: number, limitMs: number) {
  const project = createEmptyProject();
  for (let i = 0; i < count; i++) {
    const char = String.fromCodePoint(0x4e00 + i);
    project.queue.push(char);
    project.glyphs[char] = dummyGlyph(char, i + 1);
  }
  let t = performance.now();
  const outlines = collectOutlines(project);
  const coldOutline = performance.now() - t;
  t = performance.now();
  buildFont("ttf", outlines, project.font);
  const coldFont = performance.now() - t;

  // 1 文字を保存し直したとき（ほかのグリフの輪郭はキャッシュから）
  const changed = String.fromCodePoint(0x4e00);
  project.glyphs = { ...project.glyphs, [changed]: dummyGlyph(changed, 9999) };
  t = performance.now();
  const again = collectOutlines(project);
  buildFont("ttf", again, project.font);
  const incremental = performance.now() - t;
  const ok = incremental <= limitMs;
  console.log(
    `${count} 文字：最初の生成 ${Math.round(coldOutline + coldFont)}ms（輪郭 ${Math.round(coldOutline)}ms・フォント ${Math.round(coldFont)}ms）、` +
      `1 文字保存したあと ${Math.round(incremental)}ms（上限 ${limitMs}ms）${ok ? "OK" : "NG"}`,
  );
  return ok;
}

/** 1 本描いたときの保存（IndexedDB と同じく、書く値を structuredClone する保存先で測る） */
async function measureSave(count: number, limitMs: number) {
  const { saveProject } = await import("../src/lib/projects/repository");
  const { addStroke, createHistory } = await import("../src/lib/stroke/history");
  const data = new Map<string, unknown>();
  const kv = {
    get: async (k: string) => data.get(k),
    getMany: async (ks: string[]) => ks.map((k) => data.get(k)),
    set: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
    setMany: async (e: [string, unknown][]) =>
      e.forEach(([k, v]) => data.set(k, structuredClone(v))),
    del: async (k: string) => void data.delete(k),
    delMany: async (ks: string[]) => ks.forEach((k) => data.delete(k)),
    keys: async () => [...data.keys()],
  };
  const project = createEmptyProject();
  for (let i = 0; i < count; i++) {
    const char = String.fromCodePoint(0x4e00 + i);
    project.queue.push(char);
    project.glyphs[char] = dummyGlyph(char, i + 1);
    project.drawings[char] = createHistory([
      ...project.glyphs[char]!.strokes,
      ...project.glyphs[char]!.strokes,
    ]);
  }
  const id = "0b8e6c4e-2f1a-4c3b-9d5e-7a6b5c4d3e2f";
  await saveProject(kv, id, project, false);
  const c = String.fromCodePoint(0x4e00);
  const next = {
    ...project,
    drawings: {
      ...project.drawings,
      [c]: addStroke(project.drawings[c]!, dummyGlyph(c, 7).strokes[0]!),
    },
  };
  const t = performance.now();
  await saveProject(kv, id, next, true, new Date(), project);
  const ms = performance.now() - t;
  const ok = ms <= limitMs;
  console.log(
    `${count} 文字：1 本描いたあとの保存 ${Math.round(ms)}ms（上限 ${limitMs}ms）${ok ? "OK" : "NG"}`,
  );
  return ok;
}

const results = [measure(300, 500), measure(2000, 2000), await measureSave(2000, 50)];
if (results.includes(false)) process.exit(1);
