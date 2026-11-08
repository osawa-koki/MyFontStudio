import { useTaskStore } from "../store/taskStore";

/** 重い処理（zip の保存・読み込みなど）の進み具合と「取り消す」 */
export function TaskProgress() {
  const task = useTaskStore((s) => s.task);
  if (!task) return null;
  const percent = task.total > 0 ? Math.round((task.done / task.total) * 100) : null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="task-progress"
      className="fixed bottom-4 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-md border border-slate-300 bg-white p-3 text-sm shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span>
          {task.label}
          {percent !== null && `（${task.done} / ${task.total}）`}
        </span>
        <button type="button" className="btn px-2 py-1 text-xs" onClick={task.cancel}>
          取り消す
        </button>
      </div>
      <progress
        className="h-2 w-full"
        max={100}
        value={percent ?? undefined}
        aria-label={`${task.label}の進み具合`}
      />
    </div>
  );
}
