import { useEffect, useMemo, useRef } from "react";
import { isCreated } from "../lib/project/chars";
import {
  KIND_LABELS,
  isFiltered,
  viewQueue,
  type CharKind,
  type KindFilter,
  type SortKey,
  type StatusFilter,
} from "../lib/project/queueView";
import { useQueueViewStore } from "../store/queueViewStore";
import { toCodepointLabel } from "../lib/project/project";
import type { GlyphData } from "../types/project";
import { GlyphThumb } from "./GlyphThumb";

interface Props {
  queue: readonly string[];
  glyphs: Record<string, GlyphData>;
  current: string | null;
  onSelect(char: string): void;
  onDelete(char: string): void;
}

const LONG_PRESS_MS = 600;

/** 文字の削除の方法の説明（スクリーンリーダーにも伝える） */
const DELETE_HELP_ID = "char-queue-delete-help";

/**
 * 文字一覧。作成済みは緑（サムネイル付き）、未作成はグレー、編集中は枠線。
 * Delete・Backspace（キーボード）、右クリック、長押しで削除。並び替え・絞り込みができる
 */
export function CharQueue({ queue, glyphs, current, onSelect, onDelete }: Props) {
  const view = useQueueViewStore();
  const pressTimer = useRef(0);
  const longPressed = useRef(false);
  const created = queue.filter((c) => isCreated(glyphs, c)).length;
  const shown = useMemo(
    () =>
      viewQueue(queue, glyphs, {
        sort: view.sort,
        desc: view.desc,
        status: view.status,
        kind: view.kind,
        query: view.query,
      }),
    [queue, glyphs, view.sort, view.desc, view.status, view.kind, view.query],
  );
  const filtered = isFiltered(view);
  // 編集中の文字が変わったら、一覧のその文字が見えるようにスクロールする（一覧が長いとき）。
  // scrollIntoView はページもスクロールし、狭い画面では Canvas が画面の外に出るので、一覧の中だけを動かす
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !el) return;
    const l = list.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (e.top < l.top) list.scrollTop -= l.top - e.top;
    else if (e.bottom > l.bottom) list.scrollTop += e.bottom - l.bottom;
  }, [current]);

  const startPress = (char: string, pointerType: string) => {
    longPressed.current = false;
    if (pointerType === "mouse") return;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      onDelete(char);
    }, LONG_PRESS_MS);
  };
  const endPress = () => window.clearTimeout(pressTimer.current);

  return (
    <section aria-label="文字一覧" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600" aria-live="polite">
          作成済み <strong>{created}</strong> / {queue.length} 文字
          {filtered && <span className="ml-2 text-blue-800">（表示 {shown.length} 文字）</span>}
        </span>
        {filtered && (
          <button
            type="button"
            className="text-xs text-blue-700 underline"
            onClick={view.clearFilters}
          >
            絞り込みを解除
          </button>
        )}
      </div>
      <div
        className="flex flex-wrap items-center gap-2 text-sm"
        role="group"
        aria-label="並び替えと絞り込み"
      >
        <input
          type="search"
          className="input basis-full py-1"
          value={view.query}
          placeholder="検索（文字・U+3042）"
          aria-label="文字一覧を検索"
          onChange={(e) => view.set({ query: e.target.value })}
        />
        <select
          className="input py-1"
          aria-label="並び順"
          value={view.sort}
          onChange={(e) => view.set({ sort: e.target.value as SortKey })}
        >
          <option value="added">登録順</option>
          <option value="codepoint">文字コード順</option>
          <option value="updated">更新日時順</option>
        </select>
        <button
          type="button"
          className="btn px-2 py-1"
          aria-label={view.desc ? "降順（クリックで昇順）" : "昇順（クリックで降順）"}
          title={view.desc ? "降順" : "昇順"}
          onClick={() => view.set({ desc: !view.desc })}
        >
          {view.desc ? "↓ 降順" : "↑ 昇順"}
        </button>
        <select
          className="input py-1"
          aria-label="作成状況"
          value={view.status}
          onChange={(e) => view.set({ status: e.target.value as StatusFilter })}
        >
          <option value="all">すべて</option>
          <option value="uncreated">未作成</option>
          <option value="created">作成済み</option>
        </select>
        <select
          className="input py-1"
          aria-label="文字の種類"
          value={view.kind}
          onChange={(e) => view.set({ kind: e.target.value as KindFilter })}
        >
          <option value="all">すべての種類</option>
          {(Object.keys(KIND_LABELS) as CharKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <p id={DELETE_HELP_ID} className="sr-only">
        文字を選んで Delete キーまたは Backspace
        キーを押すと、一覧から削除します（右クリック・長押しでも削除できます）
      </p>
      {queue.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          上の入力欄に文字列を入力するか、プリセットを追加してください
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          条件に合う文字がありません
        </p>
      ) : (
        <ul
          ref={listRef}
          className="flex max-h-44 flex-wrap lg:max-h-[60vh] gap-1.5 overflow-auto rounded-md border border-slate-200 bg-white p-2"
        >
          {shown.map((c) => {
            const glyph = glyphs[c];
            const done = isCreated(glyphs, c);
            const isCurrent = c === current;
            return (
              // 見えていないボタンは描画を省く（何千文字あっても重くならないように）
              <li key={c} className="[contain-intrinsic-size:auto_3rem] [content-visibility:auto]">
                <button
                  type="button"
                  className={`flex h-12 min-w-12 items-center justify-center gap-1 rounded-md border px-1.5 text-lg ${
                    done
                      ? "border-green-300 bg-green-50 text-green-900"
                      : "border-slate-200 bg-slate-100 text-slate-500"
                  } ${isCurrent ? "outline-3 outline-offset-1 outline-blue-600" : ""}`}
                  aria-label={`${c}（${toCodepointLabel(c)}、${done ? "作成済み" : "未作成"}${isCurrent ? "、編集中" : ""}）`}
                  aria-current={isCurrent ? "true" : undefined}
                  title="クリック・Enter で編集。Delete キー・右クリック・長押しで削除"
                  aria-describedby={DELETE_HELP_ID}
                  onClick={() => {
                    if (longPressed.current) return;
                    onSelect(c);
                  }}
                  onKeyDown={(e) => {
                    // キーボードだけでも削除できるように（変換中は除く）
                    if (
                      (e.key === "Delete" || e.key === "Backspace") &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      onDelete(c);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    endPress();
                    onDelete(c);
                  }}
                  onPointerDown={(e) => startPress(c, e.pointerType)}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                >
                  <span>{c}</span>
                  {done && glyph && <GlyphThumb glyph={glyph} className="h-7 w-7" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
