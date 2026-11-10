import { FAMILY_NAME_MAX } from "../project/project";
import type { ProjectSummary } from "./repository";

/** 同じ名前（フォント名と日本語名）のプロジェクトが複数あれば、見分けるために uuid の先頭 8 文字を返す。なければ null */
export function distinguishingId(
  project: ProjectSummary,
  all: readonly ProjectSummary[],
): string | null {
  const same = all.filter(
    (p) => p.familyName === project.familyName && p.familyNameJa === project.familyNameJa,
  );
  return same.length > 1 ? project.id.slice(0, 8) : null;
}

/**
 * 同じフォント名（ファミリー名）のほかのプロジェクト。Windows はフォント名の大文字・小文字を区別しないので、区別せずに比べる。
 * 同じ名前のフォントを 2 つインストールすると、あとから入れた方で上書きされる
 */
export function sameFamilyName(
  familyName: string,
  all: readonly ProjectSummary[],
  selfId: string | null,
): ProjectSummary[] {
  const name = familyName.toLowerCase();
  return all.filter((p) => p.id !== selfId && p.familyName.toLowerCase() === name);
}

/** ほかのプロジェクトと重ならないフォント名（base、なければ base2・base3…。31 文字に収める） */
export function uniqueFamilyName(base: string, all: readonly ProjectSummary[]): string {
  const used = new Set(all.map((p) => p.familyName.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const name = base.slice(0, FAMILY_NAME_MAX - suffix.length) + suffix;
    if (!used.has(name.toLowerCase())) return name;
  }
}

/** 同じフォント名のプロジェクトがあるときの説明 */
export function sameFamilyNameMessage(
  familyName: string,
  others: readonly ProjectSummary[],
): string {
  const names = others.map((p) =>
    p.familyNameJa ? `${p.familyName}（${p.familyNameJa}）` : p.familyName,
  );
  return (
    `このブラウザのほかのプロジェクト（${names.join("、")}）と同じフォント名「${familyName}」です。` +
    "両方のフォントをインストールすると、あとから入れた方で上書きされます。別のフォントとして使うなら、フォント名を変えてください"
  );
}
