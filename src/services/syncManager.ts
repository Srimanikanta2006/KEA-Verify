import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect, useState } from 'react';

import { getAllLocalLogs, syncPendingLogs } from './scanLogs';

/**
 * Feature 6 — server-load resilience. The scan log mirror (scanLogs.ts) is
 * already local-first; this manager keeps it drained:
 *   • sync fires on reconnect, on app foreground, and on a 60s heartbeat
 *   • pushes are idempotent (Firestore doc id = client scanId), so retries can
 *     never double-count attendance
 *   • the UI subscribes via useSyncStatus() for the "Offline Cache Ready" state
 */

export interface SyncStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

let started = false;
let current: SyncStatus = {
  online: true,
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

function isOnlineState(isConnected: boolean | null, reachable: boolean | null): boolean {
  // `reachable === null` means "unknown" — stay optimistic, scans queue anyway.
  return Boolean(isConnected) && reachable !== false;
}

export async function getPendingCount(): Promise<number> {
  const logs = await getAllLocalLogs();
  return logs.filter((l) => l.pendingSync).length;
}

/** Drain the queue now (no-op while a sync is already running or offline). */
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

/** Called after a scan is recorded locally so the pending count updates immediately. */
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
  void NetInfo.fetch().then((state) =>
    emit({ online: isOnlineState(state.isConnected ?? null, state.isInternetReachable ?? null) })
  );

  NetInfo.addEventListener((state) => {
    const online = isOnlineState(state.isConnected ?? null, state.isInternetReachable ?? null);
    if (online !== current.online) {
      emit({ online });
      if (online) void runSyncNow(); // wifi came back — drain the queue
    }
  });

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') {
      void getPendingCount().then((p) => emit({ pending: p }));
      void runSyncNow();
    }
  });

  setInterval(() => {
    if (current.online && current.pending > 0) void runSyncNow();
  }, 60_000);
}

/** React hook: live sync status for banners/indicators. */
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
