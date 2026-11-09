/** キーの押し方（KeyboardEvent のうち、使う部分だけ） */
export type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "isComposing"
>;

/** 保存のショートカットか。Cmd/Ctrl+S は "save"、Cmd/Ctrl+Shift+S は "saveZip"（変換中・Alt 付きは対象外） */
export function saveShortcut(e: KeyLike): "save" | "saveZip" | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.isComposing) return null;
  if (e.key.toLowerCase() !== "s") return null;
  return e.shiftKey ? "saveZip" : "save";
}
