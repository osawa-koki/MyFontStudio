"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useProjectFromUrl } from "../features/projects";

/** URL の ?uuid= のプロジェクトを開いてから中身を表示する */
export function ProjectGate({ children }: { children: ReactNode }) {
  const state = useProjectFromUrl();
  if (state === "invalid") {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-xl font-bold">プロジェクトを開けません</h1>
        <p>URL の uuid が正しくありません。使い方ページのプロジェクトの一覧から開いてください。</p>
        <Link href="/" className="btn btn-primary">
          プロジェクトの一覧へ
        </Link>
      </section>
    );
  }
  if (state === "loading") {
    return (
      <p className="py-16 text-center text-slate-500" role="status">
        プロジェクトを読み込んでいます…
      </p>
    );
  }
  return <>{children}</>;
}
