import { useEffect } from "react";
import { isDirty } from "../lib/stroke/history";
import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";

/** zip に保存していない変更（または描きかけのストローク）があるか */
export function hasUnsavedChanges(): boolean {
  const { dirty, project } = useProjectStore.getState();
  if (dirty) return true;
  return Object.entries(useEditorStore.getState().histories).some(([c, h]) =>
    isDirty(h, project.glyphs[c]?.strokes),
  );
}

/** 未保存の変更があるときに、タブを閉じる・再読み込みする前に警告する（仕様 3 章）。AppShell で 1 回だけ使う */
export function useUnsavedWarning(): void {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      e.preventDefault();
      // 古いブラウザ向け
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
