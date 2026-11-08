/** ブラウザの Storage API（テストで差し替えられるよう、使う部分だけ） */
export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

export interface StorageStatus {
  /** 永続化されているか（ブラウザが空き容量の不足で自動的に消さない）。わからなければ null */
  persisted: boolean | null;
  /** 永続化を頼めるか（Storage API があるか） */
  canPersist: boolean;
  usage: number | null;
  quota: number | null;
}

export async function getStorageStatus(
  storage: StorageManagerLike | undefined,
): Promise<StorageStatus> {
  const persisted = storage?.persisted ? await storage.persisted().catch(() => null) : null;
  const estimate = storage?.estimate ? await storage.estimate().catch(() => null) : null;
  return {
    persisted,
    canPersist: typeof storage?.persist === "function",
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
  };
}

/** 永続化を頼む。すでに永続化されていれば頼まない。永続化されたら true */
export async function requestPersistence(
  storage: StorageManagerLike | undefined,
): Promise<boolean> {
  if (!storage?.persist) return false;
  try {
    if (storage.persisted && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/** バイト数を読みやすくする（1.2 MB など） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
