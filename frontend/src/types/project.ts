/** ストロークの 1 点。x, y は Canvas の em 座標（0〜1000、y 下向き）、pressure は 0〜1 */
export type StrokePoint = [x: number, y: number, pressure: number];

/** ペンを置いてから離すまでの 1 本の線 */
export interface Stroke {
  points: StrokePoint[];
  /** このストロークで筆圧を速度から推定したか。省略時はグリフの pen.simulatePressure を使う */
  simulatePressure?: boolean;
}

/** perfect-freehand に渡すペンのパラメータ（プロジェクトの初期値） */
export interface PenParams {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
}

/** グリフに保存するペンのパラメータ */
export interface GlyphPen extends PenParams {
  simulatePressure: boolean;
}

/** 送り幅の決め方。auto は East Asian Width で判定する */
export type WidthMode = "auto" | "full" | "half";

/** 1 文字分の手書きデータ（zip の rawdata/vector/U+XXXX.json と同じ形） */
export interface GlyphData {
  char: string;
  /** "U+3042" の形 */
  codepoint: string;
  canvasSize: 1000;
  widthMode: WidthMode;
  pen: GlyphPen;
  strokes: Stroke[];
  /** ISO 8601 */
  updatedAt: string;
}

export interface FontSettings {
  /** 英数字のみ、1〜31 文字 */
  familyName: string;
  /** 日本語名（任意、空文字なら付けない） */
  familyNameJa: string;
  designer: string;
  /** フォントのダウンロードと zip 保存の回数。バージョン番号に使う */
  exportCount: number;
}

export interface ProjectDefaults {
  pen: PenParams;
  /** 筆圧を使うか（OFF なら太さ一定） */
  usePressure: boolean;
  /** お手本を表示するか */
  showModel: boolean;
}

/** 描いた履歴の 1 つの操作：線を足す・すべて消す（クリア） */
export type HistoryOp = { type: "add"; stroke: Stroke } | { type: "clear" };

/**
 * 1 文字分の描いた履歴（元に戻す/やり直しの履歴）。操作の記録と、どこまで適用しているか。
 * ops[0..position) を順に適用したものが、今 Canvas にある線。position より後ろはやり直しできる操作
 */
export interface DrawingHistory {
  ops: HistoryOp[];
  position: number;
}

/** 1 つのフォントを作るための作業データ一式 */
export interface Project {
  font: FontSettings;
  defaults: ProjectDefaults;
  /** 文字一覧（入力順。未作成の文字も含む） */
  queue: string[];
  previewText: string;
  /** 作成済みのグリフ。キーは文字 */
  glyphs: Record<string, GlyphData>;
  /** 文字ごとの描いた履歴（グリフとして保存していない描きかけの線も含む）。キーは文字 */
  drawings: Record<string, DrawingHistory>;
}
