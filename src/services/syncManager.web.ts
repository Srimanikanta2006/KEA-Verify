import { useEffect, useState } from 'react';
import { getAllLocalLogs, syncPendingLogs } from './scanLogs';

export interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

let started = false;
let current: SyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: 0,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
};
const listeners = new Set<(s: SyncStatus) => void>();

function emit(patch: Partial<SyncStatus>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
}

export async function getPendingCount(): Promise<number> {
  const logs = await getAllLocalLogs();
  return logs.filter((l) => l.pendingSync).length;
}

export async function runSyncNow(): Promise<{ pushed: number; failed: number } | null> {
  if (current.syncing || !current.online) return null;
  emit({ syncing: true });
  try {
    const res = await syncPendingLogs();
    const pending = await getPendingCount();
    emit({
      syncing: false,
      pending,
      lastSyncAt: Date.now(),
      lastError: res.failed > 0 ? `${res.failed} scan(s) failed to sync` : null,
    });
    return res;
  } catch (err) {
    emit({ syncing: false, lastError: err instanceof Error ? err.message : 'sync failed' });
    return null;
  }
}

export function notifyQueueChanged(): void {
  if (!started) return;
  void getPendingCount().then((p) => {
    emit({ pending: p });
    if (p > 0 && current.online) void runSyncNow();
  });
}

export function startSyncManager(): void {
  if (started) return;
  started = true;

  void getPendingCount().then((p) => emit({ pending: p }));

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      emit({ online: true });
      void runSyncNow();
    });
    window.addEventListener('offline', () => {
      emit({ online: false });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void getPendingCount().then((p) => emit({ pending: p }));
        void runSyncNow();
      }
    });
  }

  setInterval(() => {
    if (current.online && current.pending > 0) void runSyncNow();
  }, 60_000);
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(current);
  useEffect(() => {
    startSyncManager();
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}
