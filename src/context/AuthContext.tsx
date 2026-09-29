import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { buildDemoSession, signInWithGoogle, signOutEverywhere } from '@/services/auth';
import { clearSession, loadSession, saveSession } from '@/services/session';
import type { VerifierSession } from '@/types/models';

type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextValue {
  status: AuthStatus;
  session: VerifierSession | null;
  signInGoogle: () => Promise<VerifierSession>;
  signInDemo: (email: string) => Promise<VerifierSession>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<VerifierSession | null>(null);

  // Restore persisted session on cold start (stays valid offline).
  useEffect(() => {
    (async () => {
      const restored = await loadSession();
      if (restored) {
        setSession(restored);
        setStatus('signed_in');
      } else {
        setStatus('signed_out');
      }
    })();
  }, []);

  const persist = useCallback(async (s: VerifierSession) => {
    await saveSession(s);
    await AsyncStorage.setItem('kea_last_demo_email', s.authProviderId);
    setSession(s);
    setStatus('signed_in');
  }, []);

  const signInGoogle = useCallback(async () => {
    const s = await signInWithGoogle();
    await persist(s);
    return s;
  }, [persist]);

  const signInDemo = useCallback(
    async (email: string) => {
      const s = buildDemoSession(email);
      await persist(s);
      return s;
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    await signOutEverywhere();
    await clearSession();
    setSession(null);
    setStatus('signed_out');
  }, []);

  const value = useMemo(
    () => ({ status, session, signInGoogle, signInDemo, signOut }),
    [status, session, signInGoogle, signInDemo, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
