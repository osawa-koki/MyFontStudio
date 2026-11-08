import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** 詳細（読み込めなかった文字の一覧など） */
  details?: string[];
}

export interface DialogButton<T extends string = string> {
  label: string;
  value: T;
  variant?: "primary" | "danger" | "default";
}

export interface DialogRequest {
  /** 開くたびに変わる番号（React の key に使う） */
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** Esc や外側のクリックで閉じたときの値 */
  cancelValue: string;
  /** テキスト入力を出すとき（フォント名の入力など） */
  input?: { label: string; value: string; placeholder?: string };
  resolve: (result: { value: string; input: string }) => void;
}

interface UiState {
  toasts: Toast[];
  dialog: DialogRequest | null;
  notify(message: string, kind?: ToastKind, details?: string[]): void;
  dismissToast(id: number): void;
  closeDialog(value: string, input?: string): void;
}

let nextToastId = 1;
let nextDialogId = 1;
const TOAST_MS = 6000;

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  dialog: null,

  notify(message, kind = "info", details) {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, details }] }));
    // 詳細のあるもの・エラーは、読み終わるまで残す（×で閉じる）
    if (!details && kind !== "error" && typeof window !== "undefined") {
      window.setTimeout(() => get().dismissToast(id), TOAST_MS);
    }
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  closeDialog(value, input = "") {
    const dialog = get().dialog;
    set({ dialog: null });
    dialog?.resolve({ value, input });
  },
}));

/** 確認ダイアログを出し、押されたボタンの値を返す */
export function askDialog<T extends string>(
  request: Omit<DialogRequest, "id" | "resolve" | "buttons" | "cancelValue"> & {
    buttons: DialogButton<T>[];
    cancelValue: T;
  },
): Promise<{ value: T; input: string }> {
  return new Promise((resolve) => {
    // 前のダイアログが開いたままなら、キャンセルとして閉じる
    const prev = useUiStore.getState().dialog;
    prev?.resolve({ value: prev.cancelValue, input: "" });
    useUiStore.setState({
      dialog: {
        ...request,
        id: nextDialogId++,
        resolve: resolve as DialogRequest["resolve"],
      },
    });
  });
}

/** はい/いいえの確認 */
export async function confirmDialog(
  title: string,
  message?: string,
  okLabel = "OK",
  variant: DialogButton["variant"] = "primary",
): Promise<boolean> {
  const { value } = await askDialog({
    title,
    message,
    buttons: [
      { label: "キャンセル", value: "cancel" },
      { label: okLabel, value: "ok", variant },
    ],
    cancelValue: "cancel",
  });
  return value === "ok";
}

export function notify(message: string, kind?: ToastKind, details?: string[]): void {
  useUiStore.getState().notify(message, kind, details);
}
