"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { countGlyphs } from "../lib/project/project";
import { projectHref } from "../lib/projects/repository";
import { useProjectStore } from "../store/projectStore";
import { FontDownloadMenu } from "./FontDownloadMenu";
import { FontSettingsButton } from "./FontSettingsButton";
import { ZipButtons } from "./ZipButtons";

const NAV = [
  { to: "/", label: "使い方", end: true },
  { to: "/editor", label: "入力", end: false },
  { to: "/preview", label: "プレビュー", end: false },
];

export function Header() {
  const glyphCount = useProjectStore((s) => countGlyphs(s.project));
  const dirty = useProjectStore((s) => s.dirty);
  const pathname = usePathname();
  const projectId = useProjectStore((s) => s.projectId);
  // 入力・プレビューへのリンクには、開いているプロジェクトの ?uuid= を付ける
  const hrefOf = (to: string) =>
    to === "/" ? "/" : projectHref(to as "/editor" | "/preview", projectId);
  const isActive = (to: string, end: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-blue-900">
            MyFontStudio
          </Link>
          <nav aria-label="ページ" className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                href={hrefOf(n.to)}
                aria-current={isActive(n.to, n.end) ? "page" : undefined}
                className={`rounded-md px-2 py-1 text-sm ${isActive(n.to, n.end) ? "bg-blue-100 font-bold text-blue-900" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2 text-sm">
          <FontSettingsButton />
          <span className="text-slate-500" aria-label="登録済み文字数">
            {glyphCount} 文字
          </span>
          {dirty && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800"
              title="zip に保存していない変更があります"
            >
              未保存
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ZipButtons />
          <FontDownloadMenu />
        </div>
      </div>
    </header>
  );
}
