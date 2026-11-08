import JSZip from "jszip";
import { ArchiveError } from "./common";

export { ArchiveError, archiveFileName } from "./common";
import type { GlyphData, Project } from "../../types/project";
import { parseInputChars } from "../project/chars";
import {
  DEFAULT_FAMILY_NAME,
  createEmptyProject,
  fromCodepointLabel,
  sanitizeDisplayName,
  sanitizeFamilyName,
  toCodepointLabel,
} from "../project/project";
import {
  FORMAT,
  FORMAT_VERSION,
  historyFileSchema,
  migrations,
  projectJsonSchema,
  vectorSchema,
  type ProjectJson,
} from "./schema";
import { readZipEntries } from "./zipinfo";

export const APP_VERSION = "0.1.0";

/** 不正な zip の対策：展開後の合計サイズとファイル数の上限（仕様 7.5） */
export const LIMITS = {
  maxTotalBytes: 200 * 1024 * 1024,
  maxFiles: 20_000,
  /** 1 ファイル（project.json・ベクター JSON・描いた履歴）の展開後の上限 */
  maxFileBytes: 32 * 1024 * 1024,
};
export type ArchiveLimits = typeof LIMITS;

export const PROJECT_JSON = "project.json";
export const vectorPath = (codepoint: string) => `rawdata/vector/${codepoint}.json`;
export const previewPath = (codepoint: string) => `rawdata/preview/${codepoint}.png`;
export const historyPath = (codepoint: string) => `rawdata/history/${codepoint}.json`;
const VECTOR_PATH = /^rawdata\/vector\/U\+[0-9A-F]{4,6}\.json$/;
const HISTORY_PATH = /^rawdata\/history\/U\+[0-9A-F]{4,6}\.json$/;

/** 作成済み（ストロークのある）グリフを一覧の順に並べる */
function createdGlyphs(project: Project): GlyphData[] {
  const order = [...project.queue, ...Object.keys(project.glyphs)];
  const seen = new Set<string>();
  const out: GlyphData[] = [];
  for (const c of order) {
    const g = project.glyphs[c];
    if (seen.has(c) || !g || g.strokes.length === 0) continue;
    seen.add(c);
    out.push(g);
  }
  return out;
}

/** 描いた履歴のある文字（操作が 1 つ以上ある、取り込める文字） */
function drawingChars(project: Project): string[] {
  return Object.entries(project.drawings)
    .filter(([c, h]) => h.ops.length > 0 && isValidChar(c))
    .map(([c]) => c);
}

export function toProjectJson(project: Project, savedAt: string): ProjectJson {
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion: APP_VERSION,
    savedAt,
    font: { ...project.font },
    defaults: { ...project.defaults, pen: { ...project.defaults.pen } },
    queue: [...project.queue],
    previewText: project.previewText,
    glyphs: createdGlyphs(project).map((g) => ({
      char: g.char,
      codepoint: g.codepoint,
      file: vectorPath(g.codepoint),
    })),
    histories: drawingChars(project).map((c) => {
      const codepoint = toCodepointLabel(c);
      return { char: c, codepoint, file: historyPath(codepoint) };
    }),
  };
}

export interface ArchiveInput {
  project: Project;
  savedAt: string;
  /** 保存時点のフォント（グリフが 0 個なら null） */
  ttf: ArrayBuffer | null;
  otf: ArrayBuffer | null;
  /** 文字 → 256×256 の PNG */
  previews: ReadonlyMap<string, Uint8Array>;
}

/** zip を組み立てる（仕様 7.1） */
export async function buildArchive(input: ArchiveInput): Promise<Uint8Array> {
  const { project } = input;
  const zip = new JSZip();
  // フォルダーの項目（fontfile/ など）は作らない
  const opts = { createFolders: false };
  zip.file(PROJECT_JSON, JSON.stringify(toProjectJson(project, input.savedAt), null, 2), opts);
  const name = project.font.familyName;
  if (input.ttf) zip.file(`fontfile/${name}.ttf`, input.ttf, opts);
  if (input.otf) zip.file(`fontfile/${name}.otf`, input.otf, opts);
  for (const g of createdGlyphs(project)) {
    zip.file(vectorPath(g.codepoint), JSON.stringify(g), opts);
    const png = input.previews.get(g.char);
    if (png) zip.file(previewPath(g.codepoint), png, opts);
  }
  for (const c of drawingChars(project)) {
    const codepoint = toCodepointLabel(c);
    zip.file(
      historyPath(codepoint),
      JSON.stringify({ char: c, codepoint, history: project.drawings[c] }),
      opts,
    );
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/** JSZip の StreamHelper（使う部分だけ） */
interface ZipStream {
  on(event: "data", cb: (chunk: Uint8Array) => void): ZipStream;
  on(event: "error", cb: (e: Error) => void): ZipStream;
  on(event: "end", cb: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
}

/**
 * zip の中のファイルを、実際に展開した大きさを数えながら文字列として読む。
 * zip に書かれた展開後のサイズ（中央ディレクトリの値）は偽れるので信用せず、上限を超えたら展開を止める
 */
function readText(
  file: JSZip.JSZipObject,
  limits: ArchiveLimits,
  budget: { used: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    // internalStream は JSZip の型定義にないが、少しずつ展開するための公開の API（StreamHelper）
    const stream = (
      file as unknown as { internalStream(type: "uint8array"): ZipStream }
    ).internalStream("uint8array");
    stream
      .on("data", (chunk: Uint8Array) => {
        size += chunk.length;
        budget.used += chunk.length;
        if (size > limits.maxFileBytes || budget.used > limits.maxTotalBytes) {
          stream.pause();
          reject(
            new ArchiveError(
              `展開後のサイズが大きすぎます（1 ファイル ${Math.round(limits.maxFileBytes / 1024 / 1024)}MB・合計 ${Math.round(limits.maxTotalBytes / 1024 / 1024)}MB まで）`,
            ),
          );
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (e: Error) => reject(e))
      .on("end", () => {
        const all = new Uint8Array(size);
        let p = 0;
        for (const c of chunks) {
          all.set(c, p);
          p += c.length;
        }
        resolve(new TextDecoder().decode(all));
      })
      .resume();
  });
}

export interface ReadResult {
  project: Project;
  /** 読み込めなかった文字と理由 */
  skipped: { char: string; reason: string }[];
}

/** 文字が 1 コードポイントで、取り込める文字か */
const isValidChar = (c: string) =>
  Array.from(c).length === 1 && parseInputChars(c).accepted[0] === c;

function migrate(json: Record<string, unknown>): Record<string, unknown> {
  let current = json;
  let version = Number(current.formatVersion);
  while (version < FORMAT_VERSION) {
    const step = migrations[version];
    if (!step) throw new ArchiveError(`formatVersion ${version} の読み込みには対応していません`);
    current = { ...step(current), formatVersion: version + 1 };
    version += 1;
  }
  return current;
}

/**
 * zip を読み込んでプロジェクトを復元する（仕様 7.5）。
 * 正はベクター JSON（zip の中のフォントと PNG は使わない）。壊れたベクター JSON はその文字だけ飛ばす
 */
export async function readArchive(
  buffer: ArrayBuffer,
  limits: ArchiveLimits = LIMITS,
): Promise<ReadResult> {
  let entries;
  try {
    entries = readZipEntries(buffer);
  } catch (e) {
    throw new ArchiveError(e instanceof Error ? e.message : "zip ファイルではありません");
  }
  if (entries.length > limits.maxFiles) {
    throw new ArchiveError(
      `ファイルが多すぎます（${entries.length} 個。上限 ${limits.maxFiles} 個）`,
    );
  }
  const total = entries.reduce((n, e) => n + e.uncompressedSize, 0);
  if (total > limits.maxTotalBytes) {
    throw new ArchiveError(
      `展開後のサイズが大きすぎます（上限 ${Math.round(limits.maxTotalBytes / 1024 / 1024)}MB）`,
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ArchiveError("zip ファイルが壊れています");
  }

  const projectFile = zip.file(PROJECT_JSON);
  if (!projectFile)
    throw new ArchiveError("このアプリで保存した zip ではありません（project.json がない）");
  const budget = { used: 0 };
  let raw: unknown;
  try {
    raw = JSON.parse(await readText(projectFile, limits, budget));
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    throw new ArchiveError("project.json が壊れています");
  }
  if (typeof raw !== "object" || raw === null || (raw as { format?: unknown }).format !== FORMAT) {
    throw new ArchiveError("このアプリで保存した zip ではありません");
  }
  const version = Number((raw as { formatVersion?: unknown }).formatVersion);
  if (!Number.isInteger(version) || version < 1)
    throw new ArchiveError("project.json の formatVersion が正しくありません");
  if (version > FORMAT_VERSION) {
    throw new ArchiveError(
      "新しいバージョンのアプリで保存された zip です。ページを再読み込みしてから開いてください",
    );
  }
  const parsed = projectJsonSchema.safeParse(migrate(raw as Record<string, unknown>));
  if (!parsed.success)
    throw new ArchiveError(
      `project.json の内容が正しくありません（${parsed.error.issues[0]?.path.join(".")}）`,
    );
  const json = parsed.data;

  const project = createEmptyProject();
  project.font = {
    familyName: sanitizeFamilyName(json.font.familyName) || DEFAULT_FAMILY_NAME,
    familyNameJa: sanitizeDisplayName(json.font.familyNameJa),
    designer: sanitizeDisplayName(json.font.designer),
    exportCount: json.font.exportCount,
  };
  project.defaults = { ...json.defaults, pen: { ...json.defaults.pen } };
  project.previewText = json.previewText;

  const skipped: ReadResult["skipped"] = [];
  const sizes = new Map(entries.map((e) => [e.name, e.uncompressedSize]));
  for (const entry of json.glyphs) {
    const fail = (reason: string) => skipped.push({ char: entry.char, reason });
    const expectedChar = fromCodepointLabel(entry.codepoint);
    // 想定外のパス（../ など）は読まない
    if (
      !VECTOR_PATH.test(entry.file) ||
      entry.file !== vectorPath(entry.codepoint) ||
      expectedChar !== entry.char
    ) {
      fail("ファイルの場所が正しくありません");
      continue;
    }
    if (!isValidChar(entry.char)) {
      fail("対応していない文字です");
      continue;
    }
    const file = zip.file(entry.file);
    if (!file || !sizes.has(entry.file)) {
      fail("ベクターデータがありません");
      continue;
    }
    try {
      const vector = vectorSchema.safeParse(JSON.parse(await readText(file, limits, budget)));
      if (!vector.success) {
        fail("ベクターデータの形式が正しくありません");
        continue;
      }
      if (
        vector.data.char !== entry.char ||
        vector.data.codepoint !== toCodepointLabel(entry.char)
      ) {
        fail("ベクターデータの文字が一致しません");
        continue;
      }
      project.glyphs[entry.char] = vector.data;
    } catch (e) {
      if (e instanceof ArchiveError) throw e;
      fail("ベクターデータが壊れています");
    }
  }

  // 描いた履歴。壊れていても字形は読み込んでいるので、その文字の履歴だけ飛ばす
  for (const entry of json.histories) {
    const fail = (reason: string) => skipped.push({ char: entry.char, reason });
    if (
      !HISTORY_PATH.test(entry.file) ||
      entry.file !== historyPath(entry.codepoint) ||
      fromCodepointLabel(entry.codepoint) !== entry.char ||
      !isValidChar(entry.char)
    ) {
      fail("描いた履歴の場所が正しくありません");
      continue;
    }
    const file = zip.file(entry.file);
    if (!file) {
      fail("描いた履歴がありません");
      continue;
    }
    try {
      const parsed = historyFileSchema.safeParse(JSON.parse(await readText(file, limits, budget)));
      if (!parsed.success || parsed.data.char !== entry.char) {
        fail("描いた履歴の形式が正しくありません（字形は読み込みました）");
        continue;
      }
      project.drawings[entry.char] = parsed.data.history;
    } catch (e) {
      if (e instanceof ArchiveError) throw e;
      fail("描いた履歴が壊れています（字形は読み込みました）");
    }
  }

  // 一覧：project.json の queue（正しい文字だけ）に、読み込めたグリフと履歴の文字を足す
  const queue: string[] = [];
  const seen = new Set<string>();
  for (const c of [
    ...json.queue,
    ...Object.keys(project.glyphs),
    ...Object.keys(project.drawings),
  ]) {
    if (seen.has(c) || !isValidChar(c)) continue;
    seen.add(c);
    queue.push(c);
  }
  project.queue = queue;
  return { project, skipped };
}
