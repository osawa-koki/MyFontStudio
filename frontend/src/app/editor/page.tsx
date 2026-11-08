import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectGate } from "../../components/ProjectGate";
import { EditorPage } from "../../views/EditorPage";

export const metadata: Metadata = { title: "入力" };

// ?uuid= を読む（useSearchParams）ので Suspense で囲む（静的エクスポートの決まり）
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectGate>
        <EditorPage />
      </ProjectGate>
    </Suspense>
  );
}
