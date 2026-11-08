import type { FontSettings } from "../../types/project";

/** 両形式で同じ値を使うフォントの名前とバージョン（仕様 6.4） */
export interface FontSpec {
  familyName: string;
  /** 日本語名。空なら付けない */
  familyNameJa: string;
  designer: string;
  styleName: "Regular";
  /** 例："MyHandwriting-Regular" */
  postScriptName: string;
  /** head.fontRevision（例：1.003） */
  version: number;
  /** 例："Version 1.003" */
  versionString: string;
  /** 例："MyHandwriting-2026-11-08T12:00:00.000Z" */
  uniqueId: string;
  createdAt: Date;
}

/** 書き出し回数からバージョンを作る。1.10 が 1.9 より古く見えないよう小数 3 桁にする */
export function versionFromExportCount(exportCount: number): number {
  return Math.round((1 + Math.max(0, exportCount) / 1000) * 1000) / 1000;
}

export function createFontSpec(font: FontSettings, now: Date = new Date()): FontSpec {
  const version = versionFromExportCount(font.exportCount);
  return {
    familyName: font.familyName,
    familyNameJa: font.familyNameJa,
    designer: font.designer,
    styleName: "Regular",
    postScriptName: `${font.familyName}-Regular`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 63),
    version,
    versionString: `Version ${version.toFixed(3)}`,
    uniqueId: `${font.familyName}-${now.toISOString()}`,
    createdAt: now,
  };
}
