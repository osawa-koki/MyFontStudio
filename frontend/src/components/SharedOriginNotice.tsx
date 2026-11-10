"use client";

import { useSyncExternalStore } from "react";

/** Render で配信している版（独自のオリジン） */
export const OWN_ORIGIN_URL = "https://myfontstudio.onrender.com/";

/** ホスト名は表示している間に変わらないので、変化を購読しない */
const noSubscribe = () => () => {};

/**
 * GitHub Pages（*.github.io）で開いているときのお知らせ。GitHub Pages は同じアカウントのほかのサイトとオリジンを共有するので、
 * ブラウザの保存先（IndexedDB・使用量・永続化）もほかのサイトと共有し、ほかのサイトのスクリプトから読める（仕様 10.4）
 */
export function SharedOriginNotice() {
  // 静的エクスポートの HTML には入れず（サーバーでは false）、ブラウザで開いたときに決める
  const shared = useSyncExternalStore(
    noSubscribe,
    () => window.location.hostname.endsWith(".github.io"),
    () => false,
  );
  if (!shared) return null;
  return (
    <p
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      data-testid="shared-origin-notice"
    >
      このページ（GitHub Pages）は、同じアカウントのほかのサイトとブラウザの保存先を共有しています。
      手書きのデータは外部に送信しませんが、ほかのサイトのページからは読めてしまいます（使用量の表示も、ほかのサイトの分を含みます）。
      大事な作業は、専用のアドレスの{" "}
      <a className="underline" href={OWN_ORIGIN_URL}>
        {OWN_ORIGIN_URL}
      </a>{" "}
      で行ってください（このページのデータは、zip で保存して移せます）。
    </p>
  );
}
