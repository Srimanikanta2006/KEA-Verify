import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/config/firebase';
import type { Centre, Verifier, VerifierSession } from '@/types/models';
import { DEMO_CENTRES, DEMO_VERIFIERS } from './demoData';

export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | 'cancelled'
      | 'no_id_token'
      | 'not_registered'
      | 'network'
      | 'unknown' = 'unknown'
  ) {
    super(message);
  }
}

/** Look up the verifier doc keyed by the Google account email. */
export async function lookupVerifierByEmail(
  email: string
): Promise<{ verifier: Verifier; centre: Centre } | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'verifiers', email.toLowerCase()));
  if (!snap.exists()) return null;
  const verifier = snap.data() as Verifier;
  const centreSnap = await getDoc(doc(db, 'centres', verifier.assignedCentreId));
  if (!centreSnap.exists()) {
    throw new AuthError(
      `Centre "${verifier.assignedCentreId}" not found in database.`,
      'not_registered'
    );
  }
  return { verifier, centre: centreSnap.data() as Centre };
}

export async function signInWithGoogle(): Promise<VerifierSession> {
  if (!isFirebaseConfigured) {
    throw new AuthError(
      'Firebase is not configured yet. Use Demo Mode for now.',
      'unknown'
    );
  }
  try {
    const provider = new GoogleAuthProvider();
    const fbResult = await signInWithPopup(getFirebaseAuth(), provider);
    const email = fbResult.user.email;

    if (!email) throw new AuthError('Google account has no email.', 'unknown');

    const found = await lookupVerifierByEmail(email);
    if (!found) {
      throw new AuthError(
        `"${email}" is not registered as a verifier. Ask the nodal officer to add you.`,
        'not_registered'
      );
    }
    const { verifier, centre } = found;
    return {
      verifierId: verifier.verifierId,
      name: verifier.name,
      authProviderId: email,
      role: verifier.role,
      assignedCentreId: verifier.assignedCentreId,
      centre,
      loginAt: Date.now(),
      mode: 'google',
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : 'Sign-in failed.';
    if (msg.includes('popup-closed-by-user')) {
      throw new AuthError('Sign-in popup was closed.', 'cancelled');
    }
    throw new AuthError(msg, 'unknown');
  }
}

export async function signOutEverywhere(): Promise<void> {
  try {
    if (isFirebaseConfigured) await fbSignOut(getFirebaseAuth());
  } catch {
    // ignore
  }
}

export function buildDemoSession(email: string): VerifierSession {
  const verifier = DEMO_VERIFIERS.find(
    (v) => v.authProviderId.toLowerCase() === email.trim().toLowerCase()
  );
  if (!verifier) {
    throw new AuthError(`"${email}" is not a demo verifier.`, 'not_registered');
  }
  const centre = DEMO_CENTRES.find((c) => c.centreId === verifier.assignedCentreId);
  if (!centre) {
    throw new AuthError('Assigned demo centre not found.', 'not_registered');
  }
  return {
    verifierId: verifier.verifierId,
    name: verifier.name,
    authProviderId: verifier.authProviderId,
    role: verifier.role,
    assignedCentreId: verifier.assignedCentreId,
    centre,
    loginAt: Date.now(),
    mode: 'demo',
  };
}
