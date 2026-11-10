"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useProjectFromUrl } from "../features/projects";
import { unreadableMessage } from "../lib/projects/repository";
import { takeOverProject } from "../features/tabLock";
import { useProjectStore } from "../store/projectStore";
import { useTabLockStore } from "../store/tabLockStore";

/** URL の ?uuid= のプロジェクトを開いてから中身を表示する */
export function ProjectGate({ children }: { children: ReactNode }) {
  const url = useProjectFromUrl();
  const state = url.state;
  const projectId = useProjectStore((s) => s.projectId);
  // ロックは AppShell で、開いているプロジェクトについて取る
  const lock = useTabLockStore((s) => (s.projectId === projectId ? s.status : "pending"));
  const takeoverFailed = useTabLockStore((s) => s.takeoverFailed);
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
  if (url.state === "unreadable") {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
        <h1 className="text-xl font-bold">プロジェクトを開けません</h1>
        <p className="max-w-xl">{unreadableMessage(url.reason)}</p>
        <p className="max-w-xl text-sm text-slate-600">
          保存してあるデータを上書きしないよう、このプロジェクトは開かずにおきます。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
          <Link href="/" className="btn">
            プロジェクトの一覧へ
          </Link>
        </div>
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
  if (lock === "takeover") {
    // 引き継いでいる途中は、読み直すまで古い内容なので、編集画面を出さない（描いても読み直しで消えるため）
    return (
      <p className="py-16 text-center text-slate-500" role="status">
        ほかのタブの編集を止めています…
      </p>
    );
  }
  if (lock === "blocked" || lock === "released") {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
        <h1 className="text-xl font-bold">
          {lock === "blocked"
            ? "このプロジェクトはほかのタブで開いています"
            : "ほかのタブでこのプロジェクトを開いたので、このタブでは編集を止めました"}
        </h1>
        {lock === "blocked" && takeoverFailed && (
          <p className="max-w-xl text-sm font-bold text-red-700">
            ほかのタブが応答しないため、引き継げませんでした。ほかのタブを開いて（または閉じて）から、もう一度試してください。
          </p>
        )}
        <p className="max-w-xl text-sm text-slate-600">
          同じプロジェクトを 2
          つのタブで編集すると、あとから保存した方で上書きされてしまうため、編集できるタブは 1
          つだけにしています。このタブで編集すると、ほかのタブでの編集は止まります（ほかのタブで保存した内容は読み直します）。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => projectId && void takeOverProject(projectId)}
          >
            {lock === "blocked" && takeoverFailed ? "もう一度試す" : "このタブで編集する"}
          </button>
          <Link href="/" className="btn">
            プロジェクトの一覧へ
          </Link>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}
