import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/config/firebase';
import type { Candidate } from '@/types/models';
import { DEMO_CANDIDATES } from './demoData';

const CACHE_KEY = 'kea_roster_cache_v1';
const META_KEY = 'kea_roster_meta_v1';

export interface RosterMetadata {
  lastUpdated: number | null;
  count: number;
  source: 'firestore' | 'demo' | 'cache';
}

/** Cache the whole demo roster locally on first load (offline resilience, Feature 6 reuse). */
async function cacheRoster(candidates: Candidate[], source: 'firestore' | 'demo' = 'firestore'): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(candidates));
    const meta: RosterMetadata = {
      lastUpdated: Date.now(),
      count: candidates.length,
      source,
    };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // cache is best-effort
  }
}

export async function getRosterMetadata(): Promise<RosterMetadata> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as RosterMetadata;
  } catch {}
  return {
    lastUpdated: null,
    count: DEMO_CANDIDATES.length,
    source: 'demo',
  };
}

export async function getCachedRoster(): Promise<Candidate[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Candidate[]) : null;
  } catch {
    return null;
  }
}

async function fetchRosterFromFirestore(): Promise<Candidate[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'candidates'), limit(500)));
  const candidates = snap.docs.map((d) => ({ ...(d.data() as Candidate), candidateId: d.id }));
  if (candidates.length) void cacheRoster(candidates, 'firestore');
  return candidates;
}

export async function refreshRoster(): Promise<{ success: boolean; count: number; error?: string }> {
  if (isFirebaseConfigured) {
    try {
      const candidates = await fetchRosterFromFirestore();
      return { success: true, count: candidates.length };
    } catch (err) {
      return {
        success: false,
        count: 0,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }
  await cacheRoster(DEMO_CANDIDATES, 'demo');
  return { success: true, count: DEMO_CANDIDATES.length };
}

export async function getAllCandidates(): Promise<Candidate[]> {
  if (isFirebaseConfigured) {
    try {
      return await fetchRosterFromFirestore();
    } catch {
      const cached = await getCachedRoster();
      if (cached) return cached;
    }
  }
  const cached = await getCachedRoster();
  if (cached) return cached;
  void cacheRoster(DEMO_CANDIDATES, 'demo');
  return DEMO_CANDIDATES;
}

/** Look up a candidate by roll number or candidateId (Feature 2 will use this from the QR payload). */
export async function findCandidate(rollNoOrId: string): Promise<Candidate | null> {
  const key = rollNoOrId.trim().toUpperCase();
  if (isFirebaseConfigured) {
    try {
      const db = getDb();
      const snap = await getDocs(
        query(
          collection(db, 'candidates'),
          where('rollNo', 'in', [key, rollNoOrId.trim()]),
          limit(1)
        )
      );
      if (!snap.empty) return snap.docs[0].data() as Candidate;
      const byId = await getDoc(doc(db, 'candidates', rollNoOrId.trim()));
      if (byId.exists()) return byId.data() as Candidate;
      // fall through to cache / demo roster
    } catch {
      // unauthenticated (demo session) or offline — fall through to cache/demo
    }
  }
  const cached = await getCachedRoster();
  const pool = cached ?? DEMO_CANDIDATES;
  return (
    pool.find(
      (c) => c.rollNo.toUpperCase() === key || c.candidateId.toUpperCase() === key
    ) ?? null
  );
}
