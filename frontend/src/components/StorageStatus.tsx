"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatBytes,
  getStorageStatus,
  requestPersistence,
  type StorageStatus as Status,
} from "../lib/projects/storage";
import { notify } from "../store/uiStore";

/** このブラウザへの保存の状態（永続化されているか・使用量）。永続化を頼むボタン付き */
export function StorageStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const refresh = useCallback(() => void getStorageStatus(navigator.storage).then(setStatus), []);
  useEffect(refresh, [refresh]);

  if (!status) return null;
  const persist = async () => {
    const ok = await requestPersistence(navigator.storage);
    notify(
      ok
        ? "このブラウザに、データを消さずに残すよう設定しました"
        : "ブラウザに許可されませんでした。大事な作業は zip で保存してください",
      ok ? "success" : "info",
    );
    refresh();
  };

  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-3 text-sm"
      data-testid="storage-status"
    >
      <p>
        {status.persisted ? (
          <span className="font-bold text-green-800">
            このブラウザのデータは、空き容量が足りなくなっても自動では消されません（永続化）。
          </span>
        ) : (
          <span className="text-amber-800">
            ブラウザの空き容量が足りなくなると、このブラウザのデータが自動で消されることがあります。
          </span>
        )}{" "}
        閲覧データ（キャッシュ・Cookie など）を削除すると消えるので、大事な作業は zip
        でも保存してください。
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {status.usage !== null && (
          <span>
            使用量 {formatBytes(status.usage)}
            {status.quota !== null && `（使える量の目安 ${formatBytes(status.quota)}）`}
          </span>
        )}
        {!status.persisted && status.canPersist && (
          <button type="button" className="btn py-1 text-xs" onClick={() => void persist()}>
            データを消されないようにする
          </button>
        )}
      </div>
    </div>
  );
}
