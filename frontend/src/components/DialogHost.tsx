import { useEffect, useRef, useState } from "react";
import { useUiStore, type DialogRequest } from "../store/uiStore";

const VARIANT_CLASS = { primary: "btn btn-primary", danger: "btn btn-danger", default: "btn" };

/** askDialog で開く確認ダイアログ（<dialog> を使い、Esc で閉じられる） */
export function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  return dialog ? <DialogView key={dialog.id} dialog={dialog} /> : null;
}

function DialogView({ dialog }: { dialog: DialogRequest }) {
  const close = useUiStore((s) => s.closeDialog);
  const ref = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState(dialog.input?.value ?? "");

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const primary = dialog.buttons.find((b) => b.variant === "primary");
  return (
    <dialog
      ref={ref}
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close(dialog.cancelValue);
      }}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (primary) close(primary.value, input);
        }}
      >
        <h2 id="dialog-title" className="text-lg font-bold">
          {dialog.title}
        </h2>
        {dialog.message && (
          <p className="text-sm whitespace-pre-wrap text-slate-700">{dialog.message}</p>
        )}
        {dialog.input && (
          <label className="flex flex-col gap-1 text-sm">
            {dialog.input.label}
            <input
              className="input"
              value={input}
              placeholder={dialog.input.placeholder}
              autoFocus
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {dialog.buttons.map((b) => (
            <button
              key={b.value}
              type="button"
              className={VARIANT_CLASS[b.variant ?? "default"]}
              autoFocus={!dialog.input && b.variant === "primary"}
              onClick={() => close(b.value, input)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </form>
    </dialog>
  );
}
