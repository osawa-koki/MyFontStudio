import type { Metadata } from "next";
import { EditorPage } from "../../views/EditorPage";

export const metadata: Metadata = { title: "入力" };

export default function Page() {
  return <EditorPage />;
}
