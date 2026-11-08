// opentype.js 2.0 には型定義がないので、使う部分だけを宣言する
declare module "opentype.js" {
  export class Path {
    commands: Array<{ type: string; x?: number; y?: number; x1?: number; y1?: number }>;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(x1: number, y1: number, x: number, y: number): void;
    close(): void;
  }
  export class Glyph {
    constructor(options: {
      name: string;
      unicode?: number;
      unicodes?: number[];
      advanceWidth: number;
      path: Path;
    });
    name: string;
    unicode?: number;
    advanceWidth: number;
    path: Path;
  }
  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
      designer?: string;
      version?: string;
      tables?: Record<string, unknown>;
    });
    toArrayBuffer(): ArrayBuffer;
  }
  export function parse(buffer: ArrayBuffer): {
    glyphs: { length: number; get(index: number): Glyph };
    tables: Record<string, Record<string, unknown>>;
  };
}
