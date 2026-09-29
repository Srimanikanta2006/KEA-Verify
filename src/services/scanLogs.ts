import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/config/firebase';
import { dayKeyFor } from '@/services/geofence';
import type { Candidate, ScanLog, ScanResult, VerifierSession } from '@/types/models';

/**
 * Feature 4 audit pipeline. Every scan outcome is logged: matched scans get an
 * attendance record, mismatches and duplicates get a rejection record.
 *
 * Writes are LOCAL-FIRST: the log is mirrored to AsyncStorage immediately and
 * pushed to Firestore in the background when configured + reachable. The mirror
 * doubles as the Feature 6 offline queue — scans never block on connectivity,
 * and pushes are idempotent (doc id = client-generated scanId).
 */

const MIRROR_KEY = 'kea_scanlog_mirror_v1';
const MIRROR_CAP = 500;

export interface RecordScanInput {
  candidate: Pick<Candidate, 'candidateId' | 'rollNo'>;
  session: VerifierSession;
  result: ScanResult;
  deviceLat: number | null;
  deviceLng: number | null;
  faceMatchScore?: number | null;
  /** 'manual' when the verifier typed the roll number after QR failure */
  entryMethod?: 'qr' | 'manual';
  notes?: string;
}

export function newScanId(): string {
  return Crypto.randomUUID();
}

async function readMirror(): Promise<ScanLog[]> {
  try {
    const raw = await AsyncStorage.getItem(MIRROR_KEY);
    return raw ? (JSON.parse(raw) as ScanLog[]) : [];
  } catch {
    return [];
  }
}

async function writeMirror(logs: ScanLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MIRROR_KEY, JSON.stringify(logs.slice(-MIRROR_CAP)));
  } catch {
    // best-effort
  }
}

export async function getAllLocalLogs(): Promise<ScanLog[]> {
  return readMirror();
}

/** Append a scan log locally, enqueue for sync, then push in the background. */
export async function recordScan(input: RecordScanInput): Promise<ScanLog> {
  const log: ScanLog = {
    scanId: newScanId(),
    clientScanId: '', // filled below (same value as scanId)
    candidateId: input.candidate.candidateId,
    verifierId: input.session.verifierId,
    timestamp: Date.now(),
    deviceLat: input.deviceLat,
    deviceLng: input.deviceLng,
    result: input.result,
    faceMatchScore: input.faceMatchScore ?? null,
    entryMethod: input.entryMethod ?? 'qr',
    notes: input.notes,
  };
  log.clientScanId = log.scanId;

  // Demo sessions have no Firebase auth — their logs would fail every push.
  // Mark them as local-only (never queued) so the sync UI stays truthful.
  if (input.session.mode === 'demo') {
    log.pendingSync = false;
  }

  const mirror = await readMirror();
  mirror.push(log);
  await writeMirror(mirror);

  // Feature 6: bump the sync UI + attempt immediate push when online.
  if (log.pendingSync !== false) {
    void pushLogToFirestore(log);
    void (async () => {
      try {
        const { notifyQueueChanged } = await import('./syncManager');
        notifyQueueChanged();
      } catch {
        // manager not started (e.g. pure unit usage) — safe to ignore
      }
    })();
  }
  return log;
}

/** Idempotent push — safe to retry any number of times (Feature 6 reuses this). */
export async function pushLogToFirestore(log: ScanLog): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    const db = getDb();
    await setDoc(doc(db, 'scanLogs', log.clientScanId), { ...log, pendingSync: false });
    await markSynced(log.clientScanId);
    return true;
  } catch {
    await markUnsynced(log.clientScanId);
    return false;
  }
}

async function markSynced(scanId: string): Promise<void> {
  const mirror = await readMirror();
  const next = mirror.map((l) => (l.scanId === scanId ? { ...l, pendingSync: false } : l));
  await writeMirror(next);
}

async function markUnsynced(scanId: string): Promise<void> {
  const mirror = await readMirror();
  const next = mirror.map((l) => (l.scanId === scanId ? { ...l, pendingSync: true } : l));
  await writeMirror(next);
}

/** Push every locally-pending log (called on app foreground / manual refresh in F6). */
export async function syncPendingLogs(): Promise<{ pushed: number; failed: number }> {
  const mirror = await readMirror();
  const pending = mirror.filter((l) => l.pendingSync);
  let pushed = 0;
  let failed = 0;
  for (const log of pending) {
    const ok = await pushLogToFirestore(log);
    ok ? pushed++ : failed++;
  }
  return { pushed, failed };
}

export interface ExistingVerification {
  log: ScanLog;
  verifierLabel: string;
}

/**
 * Duplicate check: has this candidate already been verified (matched or
 * manual_review) TODAY? Checks the local mirror first (works fully offline),
 * then Firestore for cross-device catches.
 */
export async function findTodaysVerification(
  candidateId: string
): Promise<ExistingVerification | null> {
  const today = dayKeyFor(Date.now());
  // Only an admitted candidate ('matched') blocks re-entry. 'manual_review' means
  // the verifier never finished the decision — a re-scan must stay possible.
  const isTodayVerified = (l: ScanLog) =>
    l.result === 'matched' && dayKeyFor(l.timestamp) === today;

  const mirror = await readMirror();
  // Latest-first so the "original check-in" shown for duplicates is the true first one.
  const local = [...mirror]
    .reverse()
    .find((l) => l.candidateId === candidateId && isTodayVerified(l));
  if (local) return { log: local, verifierLabel: local.verifierId };

  if (isFirebaseConfigured) {
    try {
      const db = getDb();
      const snap = await getDocs(
        query(
          collection(db, 'scanLogs'),
          where('candidateId', '==', candidateId),
          fbLimit(50)
        )
      );
      const remote = snap.docs
        .map((d) => d.data() as ScanLog)
        .find((l) => isTodayVerified(l));
      if (remote) return { log: remote, verifierLabel: remote.verifierId };
    } catch {
      // offline — local check above already ran
    }
  }
  return null;
}

export type ScanEvaluation =
  | { status: 'ok' }
  | { status: 'centre_mismatch'; allottedCentreId: string }
  | { status: 'duplicate'; existing: ExistingVerification };

/**
 * Feature 4 decision logic, applied after a candidate is resolved and the
 * geofence gate has passed.
 */
export function evaluateScanAgainstPolicy(
  candidate: Candidate,
  session: VerifierSession
): Promise<ScanEvaluation> {
  return (async () => {
    if (candidate.allottedCentreId !== session.assignedCentreId) {
      return { status: 'centre_mismatch', allottedCentreId: candidate.allottedCentreId };
    }
    const existing = await findTodaysVerification(candidate.candidateId);
    if (existing) return { status: 'duplicate', existing };
    return { status: 'ok' };
  })();
}
