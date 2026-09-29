import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerifierSession } from '@/types/models';

const SESSION_KEY = 'kea_verify_session_v1';

export async function saveSession(session: VerifierSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<VerifierSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VerifierSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
