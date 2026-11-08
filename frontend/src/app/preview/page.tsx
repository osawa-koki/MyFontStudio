import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectGate } from "../../components/ProjectGate";
import { PreviewPage } from "../../views/PreviewPage";

export const metadata: Metadata = { title: "プレビュー" };

// ?uuid= を読む（useSearchParams）ので Suspense で囲む（静的エクスポートの決まり）
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectGate>
        <PreviewPage />
      </ProjectGate>
    </Suspense>
  );
}
