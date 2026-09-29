import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Demo rehearsal helper: lets a verifier pin their device location to the
 * assigned centre (or a "far away" spot) so the Feature 3 gate can be demoed
 * without physically travelling. Stored in AsyncStorage so it survives restarts
 * and is clearly surfaced in the UI whenever active.
 */

const KEY = 'kea_location_override_v1';

export interface LocationOverride {
  lat: number;
  lng: number;
  label: string;
  setAt: number;
}

export async function setLocationOverride(o: LocationOverride): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(o));
}

export async function getLocationOverride(): Promise<LocationOverride | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocationOverride) : null;
  } catch {
    return null;
  }
}

export async function clearLocationOverride(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
