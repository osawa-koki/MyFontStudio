import { useEffect } from "react";
import { isDirty } from "../lib/stroke/history";
import { useEditorStore } from "../store/editorStore";
import { flushProjectSave, hasPendingSave } from "./projects";
import { useProjectStore } from "../store/projectStore";

/**
 * 保存していない描きかけのストロークがあるか、IndexedDB への保存が終わっていないか。
 * プロジェクトは自動で IndexedDB に保存するので、zip に保存していないだけでは警告しない
 */
export function hasUnsavedChanges(): boolean {
  return hasPendingSave() || hasUnsavedDrafts();
}

/** グリフとして保存していない描きかけのストロークがあるか */
export function hasUnsavedDrafts(): boolean {
  const { project } = useProjectStore.getState();
  return Object.entries(useEditorStore.getState().histories).some(([c, h]) =>
    isDirty(h, project.glyphs[c]?.strokes),
  );
}

/** 描きかけのストローク・終わっていない保存があるときに、タブを閉じる・再読み込みする前に警告する（仕様 3 章）。AppShell で 1 回だけ使う */
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
