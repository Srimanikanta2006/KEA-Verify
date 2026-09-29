/**
 * Geofence gate (Feature 3): haversine distance between the device and the
 * verifier's assigned centre, compared against centre.allowedRadiusMeters.
 * Runs BEFORE candidate lookup — an out-of-radius verifier never touches
 * candidate data. GPS itself is free, on-device, and works offline (no API key).
 */

export interface LocationFix {
  lat: number;
  lng: number;
  /** epoch ms when the fix was captured */
  timestamp: number;
  /** horizontal accuracy in meters, if the OS reports it */
  accuracyMeters?: number;
}

export interface GeofenceEvaluation {
  /** haversine distance device-to-centre, in meters */
  distanceMeters: number;
  /** configured max distance for the centre */
  allowedRadiusMeters: number;
  /** true when distance is within the (accuracy-expanded) radius */
  inside: boolean;
}

/** Great-circle distance between two coordinates, in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function evaluateGeofence(
  fix: LocationFix,
  centre: { lat: number; lng: number; allowedRadiusMeters: number },
  opts?: { graceMeters?: number }
): GeofenceEvaluation {
  const distanceMeters = haversineMeters(fix, centre);
  // GPS accuracy can legitimately spread the fix by tens of meters; expand the
  // radius by the reported accuracy (capped) plus a small grace margin.
  const grace = opts?.graceMeters ?? 25;
  const accuracyExpansion = Math.min(fix.accuracyMeters ?? 0, 50);
  const effectiveRadius = centre.allowedRadiusMeters + grace + accuracyExpansion;
  return {
    distanceMeters: Math.round(distanceMeters),
    allowedRadiusMeters: centre.allowedRadiusMeters,
    inside: distanceMeters <= effectiveRadius,
  };
}

/** "1.2 km" / "340 m" formatting for the UI. */
export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 5) * 5} m`;
  if (meters < 100000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

/** Local-time day key (YYYY-MM-DD) used for duplicate-scan scoping in Feature 4. */
export function dayKeyFor(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/*
 * Last-known-fix store: the scan screen resolves GPS for the geofence gate;
 * downstream screens (manual verification) reuse it so every audit log carries
 * the device coordinates without re-prompting the GPS radio.
 */
let lastKnownFix: LocationFix | null = null;

export function setLastKnownFix(fix: LocationFix | null): void {
  lastKnownFix = fix;
}

export function getLastKnownFix(): LocationFix | null {
  return lastKnownFix;
}
