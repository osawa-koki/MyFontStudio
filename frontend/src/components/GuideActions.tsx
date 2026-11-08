"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { openZip } from "../features/archiveActions";
import { createProjectInteractive } from "../features/projectActions";
import { deleteStoredProject, listStoredProjects } from "../features/projects";
import { projectHref, type ProjectSummary } from "../lib/projects/repository";
import { useProjectStore } from "../store/projectStore";
import { confirmDialog, notify } from "../store/uiStore";

/** 使い方ページのボタン（新しくはじめる・zip を開く）と、プロジェクトの一覧（開く・削除） */
export function GuideActions() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const currentId = useProjectStore((s) => s.projectId);

  // 待っている保存が済んでから読む（listStoredProjects の中で待つ）
  const refresh = useCallback(() => void listStoredProjects().then(setProjects), []);
  useEffect(refresh, [refresh]);

  const start = async () => {
    const id = await createProjectInteractive();
    if (id) router.push(projectHref("/editor", id));
  };

  const remove = async (p: ProjectSummary) => {
    const ok = await confirmDialog(
      `「${p.familyNameJa || p.familyName}」を削除しますか？`,
      "このブラウザに保存した手書きのデータが消えます。この操作は元に戻せません（zip に保存したファイルは消えません）。",
      "削除",
      "danger",
    );
    if (!ok) return;
    await deleteStoredProject(p.id);
    notify("プロジェクトを削除しました", "success");
    refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => void start()}>
          新しくはじめる
        </button>
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          zip を開いて続きから
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-label="続きから開く zip ファイルを選ぶ"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              void openZip(file).then((id) => {
                if (id) router.push(projectHref("/editor", id));
              });
            }
          }}
        />
      </div>

      <section aria-labelledby="projects-title" className="flex flex-col gap-2">
        <h2 id="projects-title" className="text-lg font-bold">
          このブラウザのプロジェクト
        </h2>
        {projects === null ? (
          <p className="text-sm text-slate-500">読み込んでいます…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            まだありません。「新しくはじめる」か「zip を開いて続きから」で作ってください。
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-md border bg-white p-3 ${p.id === currentId ? "border-blue-400" : "border-slate-200"}`}
              >
                <Link
                  href={projectHref("/editor", p.id)}
                  className="flex min-w-0 flex-1 flex-col hover:underline"
                  aria-label={`${p.familyNameJa || p.familyName} を開く`}
                >
                  <span className="truncate font-bold">
                    {p.familyName}
                    {p.familyNameJa && (
                      <span className="ml-1 font-normal text-slate-500">（{p.familyNameJa}）</span>
                    )}
                    {p.id === currentId && (
                      <span className="ml-2 text-xs text-blue-700">開いています</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    作成済み {p.glyphCount} / {p.charCount} 文字・更新{" "}
                    {new Date(p.updatedAt).toLocaleString("ja-JP")}
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn"
                  aria-label={`${p.familyNameJa || p.familyName} を削除`}
                  onClick={() => void remove(p)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
