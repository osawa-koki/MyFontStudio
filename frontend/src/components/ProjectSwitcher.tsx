"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { openZip } from "../features/archiveActions";
import { createProjectInteractive } from "../features/projectActions";
import { listStoredProjects } from "../features/projects";
import { distinguishingId } from "../lib/projects/display";
import { projectHref, type ProjectSummary } from "../lib/projects/repository";
import { useProjectStore } from "../store/projectStore";
import { useMenuButton } from "./useMenuButton";

const ITEM =
  "flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none";

/**
 * ヘッダーのプロジェクトの切り替え。開いているプロジェクトの名前を表示し、
 * メニューから別のプロジェクトへの切り替え・新しいプロジェクトの作成・ZIP の読み込みができる
 */
export function ProjectSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = useProjectStore((s) => s.projectId);
  const font = useProjectStore((s) => s.project.font);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 切り替え先のページ：プレビューを見ているならプレビュー、それ以外は入力ページ
  const target = pathname.startsWith("/preview") ? "/preview" : "/editor";

  const menu = useMenuButton(projects !== null);
  const { open, rootRef, buttonRef, menuRef, onMenuKeyDown } = menu;
  const toggle = () => {
    if (!open) {
      setProjects(null);
      void listStoredProjects().then(setProjects);
    }
    menu.toggle();
  };
  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp"].includes(e.key)) {
      setProjects(null);
      void listStoredProjects().then(setProjects);
    }
    menu.onButtonKeyDown(e);
  };

  const switchTo = async (id: string) => {
    menu.close();
    if (id === projectId) return;
    router.push(projectHref(target, id));
  };

  const create = async () => {
    menu.close();
    const id = await createProjectInteractive();
    if (id) router.push(projectHref("/editor", id));
  };

  // 開いているプロジェクトがまだ保存されていない（文字を追加する前）ときも、一覧の先頭に出す
  const items =
    projects && projectId && !projects.some((p) => p.id === projectId)
      ? [
          {
            id: projectId,
            familyName: font.familyName,
            familyNameJa: font.familyNameJa,
            glyphCount: 0,
            charCount: 0,
            updatedAt: "",
          },
          ...projects,
        ]
      : (projects ?? []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex max-w-[18rem] items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-bold hover:bg-slate-100"
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onKeyDown={onButtonKeyDown}
        // 読み上げの名前に、見えている文字をそのまま含める
        aria-label={`プロジェクト：${
          projectId
            ? font.familyName + (font.familyNameJa ? `（${font.familyNameJa}）` : "")
            : "プロジェクトを選ぶ"
        }（クリックで切り替え）`}
        onClick={toggle}
      >
        <span className="truncate">
          {projectId ? font.familyName : "プロジェクトを選ぶ"}
          {projectId && font.familyNameJa && (
            <span className="ml-1 font-normal text-slate-500">（{font.familyNameJa}）</span>
          )}
        </span>
        <span aria-hidden="true" className="text-xs text-slate-500">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          aria-label="プロジェクト"
          className="absolute left-1/2 z-50 mt-1 flex w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg"
        >
          <p className="px-3 pt-1 pb-1 text-xs text-slate-500">プロジェクトを切り替える</p>
          <div className="max-h-72 overflow-auto">
            {projects === null ? (
              <p className="px-3 py-2 text-slate-500">読み込んでいます…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-2 text-slate-500">まだプロジェクトがありません</p>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  tabIndex={-1}
                  aria-checked={p.id === projectId}
                  className={ITEM}
                  onClick={() => void switchTo(p.id)}
                >
                  <span aria-hidden="true" className="w-4 text-blue-700">
                    {p.id === projectId ? "✓" : ""}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-bold">
                      {p.familyName}
                      {p.familyNameJa && (
                        <span className="ml-1 font-normal text-slate-500">
                          （{p.familyNameJa}）
                        </span>
                      )}
                      {distinguishingId(p, items) && (
                        <span className="ml-1 font-mono text-xs font-normal text-slate-400">
                          {distinguishingId(p, items)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.updatedAt
                        ? `作成済み ${p.glyphCount} / ${p.charCount} 文字`
                        : "まだ文字がありません"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <hr className="my-1 border-slate-200" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={ITEM}
            onClick={() => void create()}
          >
            <span aria-hidden="true" className="w-4">
              ＋
            </span>
            新しいプロジェクト
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={ITEM}
            onClick={() => {
              menu.close();
              inputRef.current?.click();
            }}
          >
            <span aria-hidden="true" className="w-4">
              ⇪
            </span>
            <span className="flex flex-col">
              ZIP を読み込む
              <span className="text-xs text-slate-500">新しいプロジェクトとして追加します</span>
            </span>
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        data-testid="zip-input"
        aria-label="読み込む zip ファイルを選ぶ"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void (async () => {
            const id = await openZip(file);
            if (id) router.push(projectHref("/editor", id));
          })();
        }}
      />
    </div>
  );
}
