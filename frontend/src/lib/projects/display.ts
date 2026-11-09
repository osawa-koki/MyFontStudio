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
