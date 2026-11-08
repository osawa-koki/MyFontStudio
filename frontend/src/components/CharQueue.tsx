import { useRef, useState } from "react";
import { isCreated } from "../lib/project/chars";
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

/** 文字一覧。作成済みは緑（サムネイル付き）、未作成はグレー、編集中は枠線。右クリック・長押しで削除 */
export function CharQueue({ queue, glyphs, current, onSelect, onDelete }: Props) {
  const [onlyUncreated, setOnlyUncreated] = useState(false);
  const pressTimer = useRef(0);
  const longPressed = useRef(false);
  const created = queue.filter((c) => isCreated(glyphs, c)).length;
  const shown = onlyUncreated ? queue.filter((c) => !isCreated(glyphs, c) || c === current) : queue;

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
        <span className="text-slate-600">
          作成済み <strong>{created}</strong> / {queue.length} 文字
        </span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={onlyUncreated}
            onChange={(e) => setOnlyUncreated(e.target.checked)}
          />
          未作成のみ表示
        </label>
      </div>
      {queue.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          上の入力欄に文字列を入力するか、プリセットを追加してください
        </p>
      ) : (
        <ul className="flex max-h-44 flex-wrap lg:max-h-[60vh] gap-1.5 overflow-auto rounded-md border border-slate-200 bg-white p-2">
          {shown.map((c) => {
            const glyph = glyphs[c];
            const done = isCreated(glyphs, c);
            const isCurrent = c === current;
            return (
              <li key={c}>
                <button
                  type="button"
                  className={`flex h-12 min-w-12 items-center justify-center gap-1 rounded-md border px-1.5 text-lg ${
                    done
                      ? "border-green-300 bg-green-50 text-green-900"
                      : "border-slate-200 bg-slate-100 text-slate-500"
                  } ${isCurrent ? "outline-3 outline-offset-1 outline-blue-600" : ""}`}
                  aria-label={`${c}（${toCodepointLabel(c)}、${done ? "作成済み" : "未作成"}${isCurrent ? "、編集中" : ""}）`}
                  aria-current={isCurrent ? "true" : undefined}
                  title="クリックで編集、右クリック・長押しで削除"
                  onClick={() => {
                    if (longPressed.current) return;
                    onSelect(c);
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
