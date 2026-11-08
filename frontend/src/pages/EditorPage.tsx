import { DrawingCanvas } from "../components/DrawingCanvas";
import { PenSettings } from "../components/PenSettings";
import { isFullWidthChar } from "../lib/glyph/width";
import { canRedo, canUndo } from "../lib/stroke/history";
import { useEditorStore, useHistory, usePen } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";

// 文字一覧と保存は #8 で作る。ここでは Canvas の動作を確かめられるよう、編集中の文字（なければ「あ」）を描く
export function EditorPage() {
  const char = useProjectStore((s) => s.currentChar ?? s.project.queue[0] ?? "あ");
  const defaults = useProjectStore((s) => s.project.defaults);
  const setDefaults = useProjectStore((s) => s.setDefaults);
  const history = useHistory(char);
  const pen = usePen(char);
  const editor = useEditorStore();

  return (
    <section className="flex flex-col items-center gap-4">
      <p className="text-4xl font-bold">{char}</p>
      <DrawingCanvas
        char={char}
        strokes={history.strokes}
        pen={pen}
        usePressure={defaults.usePressure}
        showModel={defaults.showModel}
        halfWidth={!isFullWidthChar(char)}
        ignoreTouch={editor.ignoreTouch}
        onStroke={(s) => editor.commitStroke(char, s)}
        onPenDetected={() => editor.setIgnoreTouch(true)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn"
          disabled={!canUndo(history)}
          onClick={() => editor.undo(char)}
        >
          元に戻す
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canRedo(history)}
          onClick={() => editor.redo(char)}
        >
          やり直し
        </button>
        <button
          type="button"
          className="btn"
          disabled={history.strokes.length === 0}
          onClick={() => editor.clear(char)}
        >
          クリア
        </button>
      </div>
      <PenSettings
        pen={pen}
        usePressure={defaults.usePressure}
        showModel={defaults.showModel}
        ignoreTouch={editor.ignoreTouch}
        onPenChange={(p) => editor.setPen(char, p)}
        onUsePressureChange={(v) => setDefaults({ usePressure: v })}
        onShowModelChange={(v) => setDefaults({ showModel: v })}
        onIgnoreTouchChange={(v) => editor.setIgnoreTouch(v)}
      />
    </section>
  );
}
