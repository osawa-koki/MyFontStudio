import { z } from "zod";

export const FORMAT = "handwriting-font-project";
/**
 * zip のデータ形式のバージョン。形式を変えたら上げて、migrations にマイグレーションを足す
 * - 1：最初の形式
 * - 2：描いた履歴（rawdata/history/U+XXXX.json と project.json の histories）を追加
 */
export const FORMAT_VERSION = 2;

const finite = z.number().refine(Number.isFinite, "数値ではない");

export const penParamsSchema = z.object({
  size: finite.min(1).max(1000),
  thinning: finite.min(-1).max(1),
  smoothing: finite.min(0).max(1),
  streamline: finite.min(0).max(1),
});

const strokeSchema = z.object({
  points: z.array(z.tuple([finite, finite, finite.min(0).max(1)])).max(100_000),
  simulatePressure: z.boolean().optional(),
});

/** 描いた履歴（操作の記録と、どこまで適用しているか） */
export const drawingSchema = z
  .object({
    ops: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("add"), stroke: strokeSchema }),
          z.object({ type: z.literal("clear") }),
        ]),
      )
      .max(100_000),
    position: z.number().int().min(0),
  })
  .refine((h) => h.position <= h.ops.length, "position が ops の数を超えている");

/** rawdata/history/U+XXXX.json */
export const historyFileSchema = z.object({
  char: z.string().min(1),
  codepoint: z.string().regex(/^U\+[0-9A-F]{4,6}$/),
  history: drawingSchema,
});

/** rawdata/vector/U+XXXX.json（仕様 7.3） */
export const vectorSchema = z.object({
  char: z.string().min(1),
  codepoint: z.string().regex(/^U\+[0-9A-F]{4,6}$/),
  canvasSize: z.literal(1000),
  widthMode: z.enum(["auto", "full", "half"]),
  pen: penParamsSchema.extend({ simulatePressure: z.boolean() }),
  strokes: z.array(strokeSchema).max(10_000),
  updatedAt: z.string(),
});

/** project.json（仕様 7.2） */
export const projectJsonSchema = z.object({
  format: z.literal(FORMAT),
  formatVersion: z.number().int().min(1),
  appVersion: z.string(),
  savedAt: z.string(),
  font: z.object({
    familyName: z.string(),
    familyNameJa: z.string().default(""),
    designer: z.string().default(""),
    exportCount: z.number().int().min(0).default(0),
  }),
  defaults: z.object({
    pen: penParamsSchema,
    usePressure: z.boolean().default(true),
    showModel: z.boolean().default(true),
  }),
  queue: z.array(z.string()).max(100_000),
  previewText: z.string().default(""),
  glyphs: z
    .array(z.object({ char: z.string(), codepoint: z.string(), file: z.string() }))
    .max(100_000),
  histories: z
    .array(z.object({ char: z.string(), codepoint: z.string(), file: z.string() }))
    .max(100_000),
});

export type ProjectJson = z.infer<typeof projectJsonSchema>;
export type VectorJson = z.infer<typeof vectorSchema>;

/** 古い formatVersion の project.json を 1 つ新しい形にする関数（キーは変換前のバージョン） */
export const migrations: Record<
  number,
  (json: Record<string, unknown>) => Record<string, unknown>
> = {
  // 1 → 2：描いた履歴はない（読み込んだあと、保存済みの線から作る）
  1: (json) => ({ ...json, histories: [] }),
};
