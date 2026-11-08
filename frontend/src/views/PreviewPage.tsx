"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadFont } from "../features/actions";
import { NotdefBox } from "../components/NotdefBox";
import { parseInputChars } from "../lib/project/chars";
import { projectHref } from "../lib/projects/repository";
import { missingChars, splitPreviewText } from "../lib/project/preview";
import { useFontStore } from "../store/fontStore";
import { TEXT_COLORS, usePreviewStore, type MissingMode } from "../store/previewStore";
import { useProjectStore } from "../store/projectStore";
import { notify } from "../store/uiStore";

const MISSING_MODES: { id: MissingMode; label: string; help: string }[] = [
  {
    id: "highlight",
    label: "代替フォント＋ハイライト",
    help: "未作成の文字に薄い赤の背景を付ける",
  },
  { id: "fallback", label: "代替フォントのみ", help: "実際の Word での見え方に近い" },
  {
    id: "notdef",
    label: ".notdef 表示",
    help: "生成フォントの .notdef（×印の箱）と同じ形で表示する",
  },
];

export function PreviewPage() {
  const previewText = useProjectStore((s) => s.project.previewText);
  const queue = useProjectStore((s) => s.project.queue);
  const projectId = useProjectStore((s) => s.projectId);
  const setPreviewText = useProjectStore((s) => s.setPreviewText);
  const { family, chars, outlineCount } = useFontStore();
  const settings = usePreviewStore();
  const router = useRouter();

  // 文章が空なら、作成済みの文字を連結したものから始める
  useEffect(() => {
    if (previewText === "" && chars.size > 0) {
      setPreviewText(queue.filter((c) => chars.has(c)).join(""), { dirty: false });
    }
  }, [previewText, chars, queue, setPreviewText]);

  const segments = useMemo(() => splitPreviewText(previewText, chars), [previewText, chars]);
  const missing = useMemo(() => missingChars(previewText, chars), [previewText, chars]);

  if (outlineCount === 0 || !family) {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-xl font-bold">プレビュー</h1>
        <p>まだ文字がありません。入力ページで文字を作成してください</p>
        <Link href={projectHref("/editor", projectId)} className="btn btn-primary">
          入力ページへ
        </Link>
      </section>
    );
  }

  const color = TEXT_COLORS.find((c) => c.id === settings.color)!.value;
  const lineEm = `${settings.lineHeight}em`;
  const areaStyle: CSSProperties = {
    fontFamily: settings.missingMode === "notdef" ? `"${family}"` : `"${family}", sans-serif`,
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    color,
    writingMode: settings.vertical ? "vertical-rl" : "horizontal-tb",
    ...(settings.ruled
      ? {
          backgroundImage: `linear-gradient(${settings.vertical ? "to left" : "to bottom"}, transparent calc(100% - 1px), #cbd5e1 calc(100% - 1px))`,
          backgroundSize: settings.vertical ? `${lineEm} 100%` : `100% ${lineEm}`,
          backgroundPosition: settings.vertical ? "right top" : "left top",
        }
      : {}),
  };

  const addMissing = () => {
    const { accepted } = parseInputChars(missing.join(""));
    const store = useProjectStore.getState();
    store.addChars(accepted);
    const first = accepted[0];
    if (first) store.setCurrentChar(first);
    notify(`${accepted.length} 文字を入力ページの一覧に追加しました`, "success");
    router.push(projectHref("/editor", projectId));
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">プレビュー</h1>
      <label className="flex flex-col gap-1 text-sm">
        確かめたい文章
        <textarea
          className="input min-h-28 text-base"
          value={previewText}
          placeholder="履歴書に書く住所・氏名などを入力してください"
          onChange={(e) => setPreviewText(e.target.value)}
        />
      </label>

      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
        <legend className="px-1 text-xs text-slate-500">表示設定</legend>
        <label className="flex items-center gap-2">
          文字サイズ
          <input
            type="range"
            min={12}
            max={96}
            value={settings.fontSize}
            onChange={(e) => settings.set({ fontSize: Number(e.target.value) })}
          />
          <span className="w-12 tabular-nums">{settings.fontSize}px</span>
        </label>
        <label className="flex items-center gap-2">
          行間
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.1}
            value={settings.lineHeight}
            onChange={(e) => settings.set({ lineHeight: Number(e.target.value) })}
          />
          <span className="w-8 tabular-nums">{settings.lineHeight.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-2">
          文字色
          <select
            className="input py-1"
            value={settings.color}
            onChange={(e) => settings.set({ color: e.target.value as typeof settings.color })}
          >
            {TEXT_COLORS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={settings.vertical}
            onChange={(e) => settings.set({ vertical: e.target.checked })}
          />
          縦書き（参考）
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={settings.ruled}
            onChange={(e) => settings.set({ ruled: e.target.checked })}
          />
          罫線
        </label>
        <label className="flex items-center gap-2">
          未作成文字の表示
          <select
            className="input py-1"
            value={settings.missingMode}
            onChange={(e) => settings.set({ missingMode: e.target.value as MissingMode })}
          >
            {MISSING_MODES.map((m) => (
              <option key={m.id} value={m.id} title={m.help}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <div
        className={`overflow-auto rounded-md border border-slate-300 bg-white p-4 whitespace-pre-wrap ${settings.vertical ? "h-[28rem]" : "min-h-40"}`}
        style={areaStyle}
        data-testid="preview-area"
        aria-label="生成したフォントでの表示"
      >
        {segments.map((seg, i) => {
          if (!seg.missing) return <span key={i}>{seg.text}</span>;
          if (settings.missingMode === "notdef") {
            return Array.from(seg.text).map((c, k) => <NotdefBox key={`${i}-${k}`} char={c} />);
          }
          if (settings.missingMode === "highlight") {
            return (
              <span
                key={i}
                className="rounded-sm bg-red-100 [font-family:sans-serif]"
                data-missing="true"
              >
                {seg.text}
              </span>
            );
          }
          return <span key={i}>{seg.text}</span>;
        })}
      </div>

      <section
        aria-label="未作成の文字"
        className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3"
      >
        <h2 className="text-sm font-bold">文章の中の未作成の文字（{missing.length} 文字）</h2>
        {missing.length === 0 ? (
          <p className="text-sm text-green-800">文章の文字はすべて作成済みです</p>
        ) : (
          <>
            <p className="text-lg tracking-wider break-all">{missing.join(" ")}</p>
            <div>
              <button type="button" className="btn btn-primary" onClick={addMissing}>
                入力ページに追加して描く
              </button>
            </div>
          </>
        )}
      </section>

      <section aria-label="ダウンロード" className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void downloadFont("ttf")}>
          .ttf をダウンロード（Word 向け・推奨）
        </button>
        <button type="button" className="btn" onClick={() => void downloadFont("otf")}>
          .otf をダウンロード
        </button>
      </section>
    </div>
  );
}
