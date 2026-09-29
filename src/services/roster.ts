import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/config/firebase';
import type { Candidate } from '@/types/models';
import { DEMO_CANDIDATES } from './demoData';

const CACHE_KEY = 'kea_roster_cache_v1';

/** Cache the whole demo roster locally on first load (offline resilience, Feature 6 reuse). */
async function cacheRoster(candidates: Candidate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(candidates));
  } catch {
    // cache is best-effort
  }
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
  if (candidates.length) void cacheRoster(candidates);
  return candidates;
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
