import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/config/firebase';
import type { Centre, Verifier, VerifierSession } from '@/types/models';
import { DEMO_CENTRES, DEMO_VERIFIERS } from './demoData';

if (Platform.OS !== 'web') {
  import('@react-native-google-signin/google-signin')
    .then(({ GoogleSignin }) => {
      GoogleSignin.configure({
        // Web client id is required to mint a Firebase credential on native.
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
        offlineAccess: false,
      });
    })
    .catch(() => {});
}

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
      `Verifier is assigned to centre "${verifier.assignedCentreId}" which does not exist.`,
      'unknown'
    );
  }
  return { verifier, centre: centreSnap.data() as Centre };
}

/**
 * Full Google oAuth flow: Google sign-in → Firebase credential → verifier doc
 * lookup → session with assigned centre. Throws AuthError on any failure so the
 * login screen can show the exact reason.
 */
export async function signInWithGoogle(): Promise<VerifierSession> {
  if (!isFirebaseConfigured) {
    throw new AuthError(
      'Firebase is not configured yet. Use Demo Mode for now.',
      'unknown'
    );
  }
  try {
    let email: string | null = null;

    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      const fbResult = await signInWithPopup(getFirebaseAuth(), provider);
      email = fbResult.user.email;
    } else {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (!idToken) {
        throw new AuthError('Google sign-in returned no ID token.', 'no_id_token');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const fbUser = (await signInWithCredential(getFirebaseAuth(), credential)).user;
      email = fbUser.email ?? result.data?.user.email ?? null;
    }

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
    if (Platform.OS !== 'web') {
      try {
        const { isErrorWithCode, statusCodes } = await import(
          '@react-native-google-signin/google-signin'
        );
        if (isErrorWithCode(err)) {
          if (
            err.code === statusCodes.SIGN_IN_CANCELLED ||
            err.code === statusCodes.IN_PROGRESS
          ) {
            throw new AuthError('Sign-in cancelled.', 'cancelled');
          }
          if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new AuthError(
              'Google Play Services not available on this device.',
              'unknown'
            );
          }
        }
      } catch (subErr) {
        if (subErr instanceof AuthError) throw subErr;
      }
    }
    throw new AuthError(
      err instanceof Error ? err.message : 'Sign-in failed.',
      'unknown'
    );
  }
}

export async function signOutEverywhere(): Promise<void> {
  try {
    if (isFirebaseConfigured) await fbSignOut(getFirebaseAuth());
  } catch {
    // ignore — session clear below is what matters
  }
  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
  }
}

/** Offline-safe demo session used before Firebase keys are configured. */
export function buildDemoSession(email: string): VerifierSession {
  const verifier = DEMO_VERIFIERS.find(
    (v) => v.authProviderId.toLowerCase() === email.trim().toLowerCase()
  );
  if (!verifier) {
    throw new AuthError(`"${email}" is not in the demo verifier list.`, 'not_registered');
  }
  const centre = DEMO_CENTRES.find((ct) => ct.centreId === verifier.assignedCentreId);
  if (!centre) throw new AuthError('Demo centre missing.', 'unknown');
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
