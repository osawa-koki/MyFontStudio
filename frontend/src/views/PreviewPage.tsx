"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadFont } from "../features/actions";
import { NotdefBox } from "../components/NotdefBox";
import { projectHref } from "../lib/projects/repository";
import {
  addMissingMessage,
  classifyMissing,
  createdText,
  missingChars,
  splitPreviewText,
} from "../lib/project/preview";
import { rebuildPreviewFont } from "../features/fontPreview";
import { countGlyphs } from "../lib/project/project";
import { useFontStore } from "../store/fontStore";
import { TEXT_COLORS, usePreviewStore, type MissingMode } from "../store/previewStore";
import { useProjectStore } from "../store/projectStore";
import { useBusyMessage } from "../store/taskStore";
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
  const glyphs = useProjectStore((s) => s.project.glyphs);
  const projectId = useProjectStore((s) => s.projectId);
  const setPreviewText = useProjectStore((s) => s.setPreviewText);
  const { family, chars, status, error } = useFontStore();
  // 作成済みの文字があるかは、フォント（作っている途中・失敗したことがある）ではなくプロジェクトで数える
  const glyphCount = useProjectStore((s) => countGlyphs(s.project));
  const settings = usePreviewStore();
  const router = useRouter();
  // ほかの重い処理が動いている間は、ダウンロードを押せない
  const busyTask = useBusyMessage();

  // プロジェクトを開いて初めてプレビューを表示したとき、文章が空なら、作成済みの文字を連結したものから始める
  // （1 回だけ。利用者が消して空にした文章は埋め直さない）。
  // フォントの作り直し（300ms 後）を待たずに決まるよう、フォントではなくグリフから選ぶ
  const textInitialized = usePreviewStore((s) =>
    projectId ? s.textInitialized.has(projectId) : true,
  );
  useEffect(() => {
    if (!projectId || textInitialized) return;
    const mark = () => usePreviewStore.getState().markTextInitialized(projectId);
    if (previewText !== "") {
      mark();
      return;
    }
    const initial = createdText(queue, glyphs);
    // 作成済みの文字がまだなければ、できたときに入れる
    if (initial === "") return;
    setPreviewText(initial, { dirty: false });
    mark();
  }, [projectId, textInitialized, previewText, glyphs, queue, setPreviewText]);

  const segments = useMemo(() => splitPreviewText(previewText, chars), [previewText, chars]);
  const missing = useMemo(() => missingChars(previewText, chars), [previewText, chars]);
  // 絵文字などは一覧に追加できないので、分けて出す
  const { addable, unsupported } = useMemo(() => classifyMissing(missing), [missing]);

  const retry = (
    <button type="button" className="btn" onClick={() => void rebuildPreviewFont()}>
      もう一度作る
    </button>
  );
  if (glyphCount > 0 && !family && status === "error") {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
        <h1 className="text-xl font-bold">プレビュー</h1>
        <p>フォントを作れませんでした：{error}</p>
        {retry}
      </section>
    );
  }
  if (glyphCount > 0 && !family && status !== "ready") {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-xl font-bold">プレビュー</h1>
        <p role="status">フォントを作っています…</p>
      </section>
    );
  }
  if (glyphCount === 0 || !family) {
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
    const store = useProjectStore.getState();
    // 追加できる文字（絵文字などを除く）だけを追加し、実際に追加した数を知らせる
    const added = store.addChars(addable);
    const first = addable[0];
    if (first) store.setCurrentChar(first);
    notify(addMissingMessage(added, addable), added.length > 0 ? "success" : "info");
    router.push(projectHref("/editor", projectId));
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">プレビュー</h1>
      {status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm"
        >
          <span>
            最新の文字でフォントを作れませんでした（前に作ったフォントで表示しています）：{error}
          </span>
          {retry}
        </div>
      )}
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
            {addable.length > 0 && (
              <>
                <p className="text-lg tracking-wider break-all" data-testid="missing-addable">
                  {addable.join(" ")}
                </p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={addMissing}>
                    入力ページに追加して描く
                  </button>
                </div>
              </>
            )}
            {unsupported.length > 0 && (
              <p className="text-sm text-slate-600" data-testid="missing-unsupported">
                対応していない文字（絵文字・結合文字など）は、フォントに追加できません：
                <span className="ml-1 tracking-wider break-all">{unsupported.join(" ")}</span>
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label="ダウンロード" className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busyTask !== null}
          title={busyTask ?? undefined}
          onClick={() => void downloadFont("ttf")}
        >
          .ttf をダウンロード（Word 向け・推奨）
        </button>
        <button
          type="button"
          className="btn"
          disabled={busyTask !== null}
          title={busyTask ?? undefined}
          onClick={() => void downloadFont("otf")}
        >
          .otf をダウンロード
        </button>
      </section>
    </div>
  );
}
