"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CharQueue } from "../components/CharQueue";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { PenSettings } from "../components/PenSettings";
import { isFullWidthChar } from "../lib/glyph/width";
import { commitDraft } from "../features/glyphActions";
import { saveShortcut } from "../lib/shortcuts";
import { PRESETS, isCreated, nextUncreated, parseInputChars, prevChar } from "../lib/project/chars";
import { toCodepointLabel } from "../lib/project/project";
import { projectHref } from "../lib/projects/repository";
import { canRedo, canUndo, isDirty, strokesOf } from "../lib/stroke/history";
import { hasStrokeOutsideFrame } from "../lib/stroke/record";
import { useEditorStore, useHistory, usePen } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import { askDialog, confirmDialog, notify } from "../store/uiStore";

/** テキスト入力やダイアログにフォーカスがあるときは、ショートカットを使わない */
function isTyping(target: EventTarget | null): boolean {
  if (document.querySelector("dialog[open]")) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function EditorPage() {
  const queue = useProjectStore((s) => s.project.queue);
  const glyphs = useProjectStore((s) => s.project.glyphs);
  const defaults = useProjectStore((s) => s.project.defaults);
  const storedCurrent = useProjectStore((s) => s.currentChar);
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore.getState();
  const editor = useEditorStore();
  const [input, setInput] = useState("");

  // 編集中の文字：選んだ文字、なければ最初の未作成の文字、それもなければ先頭
  const char =
    storedCurrent && queue.includes(storedCurrent)
      ? storedCurrent
      : (nextUncreated(queue, glyphs, null) ?? queue[0] ?? null);
  const history = useHistory(char ?? "");
  const pen = usePen(char ?? "");
  const strokes = strokesOf(history);
  const dirty = char !== null && isDirty(history, glyphs[char]?.strokes);
  const allDone = queue.length > 0 && queue.every((c) => isCreated(glyphs, c));

  const addText = (text: string) => {
    const { accepted, unsupported } = parseInputChars(text);
    const added = useProjectStore.getState().addChars(accepted);
    if (unsupported.length > 0) {
      notify(
        `対応していない文字（絵文字・結合文字など）は追加しませんでした：${unsupported.join(" ")}`,
      );
    }
    if (added.length > 0 && !char) project.setCurrentChar(added[0]!);
    return added;
  };

  /** プリセットを、追加する文字数を示して確かめてから追加する */
  const addPreset = async (preset: (typeof PRESETS)[number]) => {
    const inQueue = new Set(useProjectStore.getState().project.queue);
    const fresh = preset.chars.filter((c) => !inQueue.has(c));
    if (fresh.length === 0) {
      notify(`${preset.label}の ${preset.chars.length} 文字は、すべて一覧にあります`);
      return;
    }
    const already = preset.chars.length - fresh.length;
    const ok = await confirmDialog(
      `${preset.label}を ${fresh.length} 文字追加しますか？`,
      `${fresh.slice(0, 20).join(" ")}${fresh.length > 20 ? " …" : ""}` +
        (already > 0
          ? `\n（${preset.chars.length} 文字のうち、${already} 文字はすでに一覧にあります）`
          : ""),
      "追加する",
    );
    if (!ok) return;
    const added = addText(fresh.join(""));
    notify(`${preset.label}を ${added.length} 文字追加しました`, "success");
  };

  /** 編集中の文字を保存する。advance なら次の未作成の文字へ進む */
  const save = (advance: boolean) => {
    if (!char || !commitDraft(char)) return;
    if (advance) {
      const { project: p, setCurrentChar } = useProjectStore.getState();
      const next = nextUncreated(p.queue, p.glyphs, char);
      if (next) setCurrentChar(next);
    }
  };

  /** 別の文字へ移る。未保存のストロークがあれば確かめる */
  const goTo = async (target: string | null) => {
    if (!target || target === char) return;
    if (char && dirty) {
      const { value } = await askDialog({
        title: `「${char}」は保存されていません`,
        message:
          "描いた線をどうしますか？「そのまま移動」すると、描きかけのまま残ります（あとで戻って続きを描けます）。",
        buttons: [
          { label: "キャンセル", value: "cancel" },
          { label: "破棄して移動", value: "discard", variant: "danger" },
          { label: "そのまま移動", value: "keep" },
          { label: "保存して移動", value: "save", variant: "primary" },
        ],
        cancelValue: "cancel",
      });
      if (value === "cancel") return;
      if (value === "save") save(false);
      else if (value === "discard") editor.discard(char);
    }
    project.setCurrentChar(target);
  };

  const skip = () => void goTo(nextUncreated(queue, glyphs, char));
  const prev = () => void goTo(prevChar(queue, char));

  const remove = async (c: string) => {
    const created = isCreated(glyphs, c);
    const ok = await confirmDialog(
      `「${c}」を一覧から削除しますか？`,
      created ? "作成済みの字形も削除されます。この操作は元に戻せません。" : undefined,
      "削除",
      "danger",
    );
    if (!ok) return;
    editor.discard(c);
    useProjectStore.getState().removeChar(c);
  };

  // ショートカット：Enter・Ctrl/Cmd+S 保存、← 前へ、→ スキップ、Ctrl/Cmd+Z 元に戻す、Ctrl/Cmd+Shift+Z やり直し
  // （Ctrl/Cmd+Shift+S の zip で保存と、ブラウザの「ページを保存」を止めるのは useSaveShortcut）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd+S はテキスト入力中も効かせる（テキストの編集と重ならないため）
      if (saveShortcut(e) === "save") {
        if (char && !document.querySelector("dialog[open]")) save(true);
        return;
      }
      if (!char || isTyping(e.target) || e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo(char);
        else editor.undo(char);
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo(char);
      } else if (mod || e.altKey) {
        return;
      } else if (e.key === "Enter") {
        // ボタンにフォーカスがあるときの Enter はボタンの動作に任せる
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        save(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    // PC（lg 以上）では左に文字列の入力と一覧、右に Canvas を並べる。狭い画面では縦に積む
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-start">
      <div className="flex flex-col gap-4">
        <h1 className="sr-only">入力</h1>
        <section className="flex flex-col gap-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addText(input);
              setInput("");
            }}
          >
            <label className="text-sm text-slate-600" htmlFor="chars-input">
              追加する文字列
              <span className="ml-2 text-xs text-slate-500">
                複数行でも入力できます（改行・空白は除きます）。Ctrl/⌘+Enter でも追加
              </span>
            </label>
            <textarea
              id="chars-input"
              className="input min-h-20 resize-y"
              rows={3}
              value={input}
              placeholder={"作りたい文字を入力\n例：大澤太郎\n　　東京都千代田区"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter は改行。Ctrl/Cmd+Enter で追加する（変換中の Enter は除く）
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={input.trim() === ""}>
                追加
              </button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">プリセット：</span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="btn" onClick={() => void addPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
          <CharQueue
            queue={queue}
            glyphs={glyphs}
            current={char}
            onSelect={(c) => void goTo(c)}
            onDelete={(c) => void remove(c)}
          />
        </section>

        {allDone && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-300 bg-green-50 p-3"
          >
            <span className="font-bold text-green-900">すべての文字を作成しました 🎉</span>
            <Link href={projectHref("/preview", projectId)} className="btn btn-primary">
              プレビューで確かめる
            </Link>
          </div>
        )}
      </div>

      {char && (
        <section aria-label="手書き入力" className="flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold" data-testid="current-char">
              {char}
            </span>
            <span className="font-mono text-sm text-slate-500">{toCodepointLabel(char)}</span>
            {dirty && (
              <span className="text-xs font-bold text-amber-700">未保存のストロークがあります</span>
            )}
          </div>
          <DrawingCanvas
            char={char}
            strokes={strokes}
            pen={pen}
            usePressure={defaults.usePressure}
            showModel={defaults.showModel}
            halfWidth={!isFullWidthChar(char)}
            ignoreTouch={editor.ignoreTouch}
            onStroke={(s) => editor.commitStroke(char, s)}
            onPenDetected={() => {
              if (editor.penDetected()) {
                notify(
                  "ペンを検出したので、指の入力を無視します（ペン設定の「指の入力を無視」で変えられます）",
                );
              }
            }}
          />
          {hasStrokeOutsideFrame(strokes) && (
            <p className="text-xs text-amber-800" role="status" data-testid="outside-frame">
              枠の外にはみ出した線があります。枠の外は表示されませんが、フォントには入ります（いらなければ元に戻してください）
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn"
              disabled={!canUndo(history)}
              onClick={() => editor.undo(char)}
              title="Ctrl/Cmd+Z"
            >
              元に戻す
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canRedo(history)}
              onClick={() => editor.redo(char)}
              title="Ctrl/Cmd+Shift+Z"
            >
              やり直し
            </button>
            <button
              type="button"
              className="btn"
              disabled={strokes.length === 0}
              onClick={() => editor.clear(char)}
            >
              クリア
            </button>
            <button
              type="button"
              className="btn"
              disabled={!prevChar(queue, char)}
              onClick={prev}
              title="←"
            >
              ← 前へ
            </button>
            <button
              type="button"
              className="btn"
              onClick={skip}
              title="→"
              disabled={!nextUncreated(queue, glyphs, char)}
            >
              スキップ →
            </button>
            <button
              type="button"
              className="btn btn-primary min-w-24"
              disabled={strokes.length === 0}
              onClick={() => save(true)}
              title="Enter・Ctrl/⌘+S"
            >
              保存
            </button>
          </div>
          <PenSettings
            pen={pen}
            usePressure={defaults.usePressure}
            showModel={defaults.showModel}
            ignoreTouch={editor.ignoreTouch}
            onPenChange={(p) => editor.setPen(char, p)}
            onUsePressureChange={(v) => project.setDefaults({ usePressure: v })}
            onShowModelChange={(v) => project.setDefaults({ showModel: v })}
            onIgnoreTouchChange={(v) => editor.setIgnoreTouch(v)}
          />
        </section>
      )}
    </div>
  );
}
