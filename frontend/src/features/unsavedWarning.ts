import { useEffect } from "react";
import { isDirty } from "../lib/stroke/history";
import { useProjectStore } from "../store/projectStore";
import { flushProjectSave, hasPendingSave } from "./projects";

/**
 * IndexedDB への保存が終わっていないか。
 * 描きかけの線も描いた履歴としてプロジェクトに保存するので、それだけでは警告しない
 */
export function hasUnsavedChanges(): boolean {
  return hasPendingSave();
}

/** グリフとして保存していない描きかけの線がある文字 */
export function unsavedDraftChars(): string[] {
  const { project } = useProjectStore.getState();
  return Object.entries(project.drawings)
    .filter(([c, h]) => isDirty(h, project.glyphs[c]?.strokes))
    .map(([c]) => c);
}

/** 保存が終わっていないときに、タブを閉じる・再読み込みする前に警告する（仕様 3 章）。AppShell で 1 回だけ使う */
export function useUnsavedWarning(): void {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // 500ms 待っている保存は、ここで書き込みを始める（終わるまでは警告して時間をかせぐ）
      void flushProjectSave();
      if (!hasUnsavedChanges()) return;
      e.preventDefault();
      // 古いブラウザ向け
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
