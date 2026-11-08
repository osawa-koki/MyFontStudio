import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]),[role="menuitemradio"]:not([disabled])';

/**
 * メニューボタン（WAI-ARIA の Menu Button パターン）のキー操作とフォーカス。
 * - ボタン：クリック（Enter・Space）・↓ で開いて最初の項目へ、↑ で開いて最後の項目へ
 * - メニュー：↑↓ で移動（端で折り返す）、Home・End、Esc で閉じてボタンに戻る、Tab で閉じる
 * - メニューの外をクリックすると閉じる
 * ready：項目がそろったか（あとから読み込むときは false。そろうまではメニュー自体にフォーカスし、そろったら項目に移す）
 */
export function useMenuButton(ready = true) {
  const [open, setOpenState] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<"first" | "last">("first");

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  const focusItem = useCallback((which: "first" | "last") => {
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const target = which === "first" ? list[0] : list[list.length - 1];
    (target ?? menuRef.current)?.focus();
  }, []);

  const close = useCallback((returnFocus = true) => {
    setOpenState(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const openMenu = (which: "first" | "last" = "first") => {
    focusTarget.current = which;
    setOpenState(true);
  };

  // 開いたら（項目がそろったら）項目にフォーカスする。そろうまではメニュー自体に
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active === buttonRef.current || active === menuRef.current || active === document.body) {
      if (ready) focusItem(focusTarget.current);
      else menuRef.current?.focus();
    }
  }, [open, ready, focusItem]);

  // メニューの外のクリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenState(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onButtonKeyDown = (e: KeyboardEvent) => {
    // Enter・Space はボタンのクリック（toggle）に任せる
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openMenu("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu("last");
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i < 0 ? list.length - 1 : i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(list.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") close(false);
  };

  return {
    open,
    /** 開く・閉じる（クリック） */
    toggle: () => (open ? close(false) : openMenu("first")),
    close,
    rootRef,
    buttonRef,
    menuRef,
    onButtonKeyDown,
    onMenuKeyDown,
  };
}
