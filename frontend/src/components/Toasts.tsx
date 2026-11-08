import { useUiStore } from "../store/uiStore";

const KIND_CLASS = {
  info: "border-slate-300 bg-white",
  success: "border-green-300 bg-green-50",
  error: "border-red-300 bg-red-50",
} as const;

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto rounded-md border p-3 text-sm shadow ${KIND_CLASS[t.kind]}`}
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 whitespace-pre-wrap">{t.message}</p>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-900"
              aria-label="通知を閉じる"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
          {t.details && t.details.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs text-slate-700">
              {t.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
