import { create } from "zustand";

export type MissingMode = "highlight" | "fallback" | "notdef";

export const TEXT_COLORS = [
  { id: "black", label: "黒", value: "#111111" },
  { id: "navy", label: "紺", value: "#1f2f66" },
  { id: "blueblack", label: "青黒", value: "#26324a" },
] as const;

/** 適用画面の表示設定（画面を移動しても保つ。zip には入れない） */
interface PreviewState {
  fontSize: number;
  lineHeight: number;
  color: (typeof TEXT_COLORS)[number]["id"];
  vertical: boolean;
  ruled: boolean;
  missingMode: MissingMode;
  set(state: Partial<Omit<PreviewState, "set">>): void;
}

export const usePreviewStore = create<PreviewState>()((set) => ({
  fontSize: 24,
  lineHeight: 1.6,
  color: "black",
  vertical: false,
  ruled: true,
  missingMode: "highlight",
  set: (state) => set(state),
}));
