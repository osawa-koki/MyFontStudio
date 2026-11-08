import type { Metadata } from "next";
import { PreviewPage } from "../../views/PreviewPage";

export const metadata: Metadata = { title: "プレビュー" };

export default function Page() {
  return <PreviewPage />;
}
