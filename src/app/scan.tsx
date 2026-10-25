import { MaterialIcons, type IconName } from '@/components/Icon';
import { Camera, CameraType } from 'react-native-camera-kit';
import Geolocation from 'react-native-geolocation-service';
import { useRouter } from '@/navigation/router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncBanner } from '@/components/SyncBanner';
import { Colors, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { DEMO_CENTRES } from '@/services/demoData';
import { compareLiveToReference, FACE_MATCH_THRESHOLD } from '@/services/faceMatch';
import {
  evaluateGeofence,
  formatDistance,
  setLastKnownFix,
  type GeofenceEvaluation,
  type LocationFix,
} from '@/services/geofence';
import {
  clearLocationOverride,
  getLocationOverride,
  setLocationOverride,
  type LocationOverride,
} from '@/services/locationOverride';
import { parseKeaQr } from '@/services/qr';
import {
  MANUAL_FALLBACK_MS,
  type ScanGuidance,
} from '@/services/robustScan';
import { findCandidate } from '@/services/roster';
import {
  evaluateScanAgainstPolicy,
  recordScan,
  type ExistingVerification,
  type ScanEvaluation,
} from '@/services/scanLogs';
import { soundFeedback } from '@/services/soundFeedback';
import type { Candidate, ScanResult } from '@/types/models';


type ScanState =
  | { phase: 'scanning' }
  | { phase: 'resolving'; raw: string }
  | { phase: 'found'; candidate: Candidate; raw: string; evaluation: ScanEvaluation }
  | { phase: 'not_found'; raw: string }
  | { phase: 'manual_entry' };

/** How long continuous scanning struggles before the manual path auto-appears. */
const MANUAL_FALLBACK_AFTER_MS = MANUAL_FALLBACK_MS;

function centreDisplayName(centreId: string): string {
  const found = DEMO_CENTRES.find((ct) => ct.centreId === centreId);
  if (found) return `${found.name} (${found.code})`;
  return centreId.replace('centre_', '').toUpperCase();
}

type GeoState =
  | { phase: 'checking' }
  | { phase: 'permission_denied' }
  | { phase: 'unavailable'; reason: string }
  | { phase: 'blocked'; geo: GeofenceEvaluation }
  | { phase: 'ready'; geo: GeofenceEvaluation };

const DEMO_OVERRIDE_PILL = false; // keep the design clean; override controls live in the blocked/ready banner

export default function ScanScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [torch, setTorch] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [scan, setScan] = useState<ScanState>({ phase: 'scanning' });
  const [geo, setGeo] = useState<GeoState>({ phase: 'checking' });
  const [override, setOverride] = useState<LocationOverride | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const [rapidMode, setRapidMode] = useState(false);
  const [rapidBanner, setRapidBanner] = useState<{
    name: string;
    rollNo: string;
    room?: string;
  } | null>(null);
  const [guidance, setGuidance] = useState<ScanGuidance | null>(null);
  const [manualEntry, setManualEntry] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [scanningSince, setScanningSince] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const cooldown = useRef<number>(0);
  const cameraRef = useRef<any>(null);
  const [zoom, setZoom] = useState(1.0);
  const [focusing, setFocusing] = useState(false);

  const changeZoom = useCallback((lvl: number) => {
    setZoom(lvl);
  }, []);

  const triggerFocus = useCallback(() => {
    setFocusing(true);
    setTimeout(() => setFocusing(false), 1200);
  }, []);

  const requestCamera = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'KEA-Verify needs camera access to scan candidate QR codes and verify identity.',
            buttonPositive: 'OK',
          }
        );
        setCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
      } catch {
        setCameraPermission('denied');
      }
    } else {
      setCameraPermission('granted');
    }
  }, []);

  useEffect(() => {
    void requestCamera();
  }, [requestCamera]);

  const centre = session?.centre;

  const runGeoCheck = useCallback(async () => {
    if (!centre) return;
    setGeoBusy(true);
    try {
      const existing = await getLocationOverride();
      setOverride(existing);
      if (existing) {
        const geoEval = evaluateGeofence(
          { lat: existing.lat, lng: existing.lng, timestamp: existing.setAt },
          centre
        );
        const fix: LocationFix = { lat: existing.lat, lng: existing.lng, timestamp: existing.setAt };
        setLastFix(fix);
        setLastKnownFix(fix);
        setGeo(geoEval.inside ? { phase: 'ready', geo: geoEval } : { phase: 'blocked', geo: geoEval });
        return;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setGeo({ phase: 'permission_denied' });
          return;
        }
      }

      const pos = await new Promise<any>((resolvePos, rejectPos) => {
        Geolocation.getCurrentPosition(resolvePos, rejectPos, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
        });
      });

      // Detect mock / simulated GPS on supported devices
      const isMocked = Boolean(pos?.mocked);
      const geoEval = evaluateGeofence(
        {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracyMeters: pos.coords.accuracy ?? undefined,
          isMocked,
        },
        centre
      );
      const realFix: LocationFix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: pos.timestamp,
        accuracyMeters: pos.coords.accuracy ?? undefined,
        isMocked,
      };
      setLastFix(realFix);
      setLastKnownFix(realFix);
      setGeo(geoEval.inside ? { phase: 'ready', geo: geoEval } : { phase: 'blocked', geo: geoEval });
    } catch (err) {
      setGeo({
        phase: 'unavailable',
        reason: err instanceof Error ? err.message : 'Location services failed.',
      });
    } finally {
      setGeoBusy(false);
    }
  }, [centre]);

  useEffect(() => {
    void runGeoCheck();
  }, [runGeoCheck]);

  const resolve = useCallback(
    async (raw: string, entryMethod: 'qr' | 'manual' = 'qr') => {
      setScan({ phase: 'resolving', raw });
      const payload = parseKeaQr(raw);
      const key = payload?.rollNo ?? raw.trim();
      const candidate = key ? await findCandidate(key) : null;
      if (!candidate || !session) {
        soundFeedback.playError();
        setScan({ phase: 'not_found', raw });
        return;
      }

      // Feature 4 policy gate: centre mismatch, then duplicate-verification.
      const evaluation = await evaluateScanAgainstPolicy(candidate, session);

      // Rejections are logged immediately; the 'ok' path logs attendance only
      // after face verification completes (Feature 5 capture / manual confirm).
      if (evaluation.status !== 'ok') {
        soundFeedback.playError();
        const fix = lastFix;
        const overrideNote = override ? ` (location override: ${override.label})` : '';
        const result: ScanResult =
          evaluation.status === 'centre_mismatch'
            ? 'rejected_centre_mismatch'
            : 'rejected_duplicate';
        const notes =
          evaluation.status === 'centre_mismatch'
            ? `Candidate allotted to ${evaluation.allottedCentreId}, scanned by ${session.assignedCentreId}${overrideNote}`
            : `Already verified at ${new Date(evaluation.existing.log.timestamp).toLocaleTimeString()} by ${evaluation.existing.verifierLabel}${overrideNote}`;
        void recordScan({
          candidate,
          session,
          result,
          deviceLat: fix?.lat ?? null,
          deviceLng: fix?.lng ?? null,
          entryMethod,
          notes,
        });
        setScan({ phase: 'found', candidate, raw, evaluation });
        return;
      }

      // If in Rapid Gate Mode and status is ok, auto-admit instantly with audio chime!
      if (rapidMode) {
        soundFeedback.playSuccess();
        void recordScan({
          candidate,
          session,
          result: 'matched',
          deviceLat: lastFix?.lat ?? null,
          deviceLng: lastFix?.lng ?? null,
          entryMethod,
          notes: 'Rapid Gate Mode (continuous scan auto-admit)',
        });
        setRapidBanner({
          name: candidate.name,
          rollNo: candidate.rollNo,
          room: candidate.allottedRoom,
        });
        setTimeout(() => {
          setRapidBanner(null);
          setScan({ phase: 'scanning' });
          setScanningSince(Date.now());
        }, 1600);
        return;
      }

      setScan({ phase: 'found', candidate, raw, evaluation });
    },
    [session, lastFix, override, rapidMode]
  );

  const onBarcode = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - cooldown.current < 2000) return;
      cooldown.current = now;
      void resolve(data);
    },
    [resolve]
  );

  const reset = useCallback(() => {
    setScan({ phase: 'scanning' });
    setScanningSince(Date.now());
  }, []);

  // Layer 5: after N seconds of struggle, offer the manual path automatically.
  // `tick` forces a re-render each second while the timer is relevant.
  const elapsedMs = useMemo(
    () => (scanningSince !== null ? Date.now() - scanningSince : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scanningSince, tick]
  );

  // Progressive coaching guidance while scanning (camera decode runs natively via CameraX & Google ML Kit)
  useEffect(() => {
    if (geo.phase !== 'ready' || scan.phase !== 'scanning') {
      setGuidance(null);
      return;
    }
    if (scanningSince === null) {
      setScanningSince(Date.now());
    }
    if (elapsedMs < 3000) {
      setGuidance({ code: 'steady', message: 'Center the QR code in the frame' });
    } else if (elapsedMs < 6000) {
      setGuidance({ code: 'closer', message: 'Hold 15–25 cm away · Tap screen to refocus' });
    } else if (elapsedMs < 10000) {
      setGuidance({ code: 'dark', message: 'Ensure good lighting · Try turning on flash' });
    } else {
      setGuidance({ code: 'contrast', message: 'QR unreadable? Tap below for manual entry' });
    }
  }, [geo.phase, scan.phase, elapsedMs, scanningSince]);
  const manualFallbackDue =
    (manualOpen ||
      (geo.phase === 'ready' && scan.phase === 'scanning' && elapsedMs > MANUAL_FALLBACK_AFTER_MS)) &&
    scan.phase === 'scanning';
  useEffect(() => {
    if (geo.phase !== 'ready' || scan.phase !== 'scanning') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [geo.phase, scan.phase]);

  const handleCapture = useCallback(
    async (candidate: Candidate) => {
      setCapturing(true);
      try {
        const photo = await cameraRef.current?.capture();
        if (!photo?.uri) throw new Error('Capture failed');
        const outcome = await compareLiveToReference(photo.uri, candidate.photoUrl);
        const score = outcome.score;
        const matched = outcome.mode === 'embedding' && score !== null && score >= FACE_MATCH_THRESHOLD;
        if (!session) throw new Error('Session expired');
        // Attendance log with the real biometric outcome.
        void recordScan({
          candidate,
          session,
          result: matched ? 'matched' : 'manual_review',
          deviceLat: lastFix?.lat ?? null,
          deviceLng: lastFix?.lng ?? null,
          faceMatchScore: score,
          notes:
            outcome.mode === 'manual_only'
              ? `manual route: ${outcome.reason ?? 'model unavailable'}`
              : `face match ${(score! * 100).toFixed(1)}% (threshold ${FACE_MATCH_THRESHOLD * 100}%)`,
        });
        if (matched) {
          soundFeedback.playSuccess();
          router.replace({
            pathname: '/verified',
            params: { candidateId: candidate.candidateId, score: score!.toFixed(4), via: 'embedding' },
          });
        } else {
          soundFeedback.playError();
          router.replace({
            pathname: '/manual-verification',
            params: {
              candidateId: candidate.candidateId,
              score: score !== null ? score.toFixed(4) : '',
              liveUri: photo.uri,
              reason: outcome.reason ?? '',
            },
          });
        }
      } catch {
        setCaptureError(true);
      } finally {
        setCapturing(false);
      }
    },
    [router, session, lastFix]
  );

  const submitManualEntry = useCallback(async () => {
    const key = manualEntry.trim();
    if (!key) return;
    cooldown.current = Date.now();
    await resolve(key, 'manual');
    setManualEntry('');
  }, [manualEntry, resolve]);

  const handleManualOverride = useCallback(
    (candidate: Candidate) => {
      router.replace({
        pathname: '/manual-verification',
        params: { candidateId: candidate.candidateId, score: '', liveUri: '', reason: 'verifier_override' },
      });
    },
    [router]
  );

  const handleQuickAdmit = useCallback(
    async (candidate: Candidate) => {
      if (!session) return;
      soundFeedback.playSuccess();
      await recordScan({
        candidate,
        session,
        result: 'matched',
        deviceLat: lastFix?.lat ?? null,
        deviceLng: lastFix?.lng ?? null,
        entryMethod: 'qr',
        notes: 'Gate admission cleared by invigilator',
      });
      router.replace({
        pathname: '/verified',
        params: { candidateId: candidate.candidateId, via: 'invigilator' },
      });
    },
    [session, lastFix, router]
  );


  const pinToCentre = async () => {
    if (!centre) return;
    const o: LocationOverride = {
      lat: centre.lat,
      lng: centre.lng,
      label: `Pinned to ${centre.name}`,
      setAt: Date.now(),
    };
    await setLocationOverride(o);
    await runGeoCheck();
  };

  const pinFarAway = async () => {
    if (!centre) return;
    const o: LocationOverride = {
      lat: centre.lat + 0.05,
      lng: centre.lng + 0.05,
      label: 'Simulated far away (~7 km)',
      setAt: Date.now(),
    };
    await setLocationOverride(o);
    await runGeoCheck();
  };

  const clearOverride = async () => {
    await clearLocationOverride();
    await runGeoCheck();
  };

  const scannerActive =
    geo.phase === 'ready' && scan.phase === 'scanning' && !capturing;

  if (cameraPermission === 'checking' || geo.phase === 'checking') {
    return (
      <Centered icon="location-searching" text="Checking permissions and location at the exam centre…" />
    );
  }

  if (cameraPermission === 'denied') {
    return (
      <Centered
        icon="videocam-off"
        text="Camera access is required to scan candidate QR codes and verify identity."
        actionLabel="Grant Camera Permission"
        onAction={() => void requestCamera()}
        secondaryActionLabel="Back to Dashboard"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  if (geo.phase === 'permission_denied') {
    return (
      <Centered
        icon="location-off"
        text="Location access is required to confirm you are at your assigned exam centre."
        actionLabel="Grant Location Permission"
        onAction={() => void runGeoCheck()}
        secondaryActionLabel="Back to Dashboard"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  if (geo.phase === 'unavailable') {
    return (
      <Centered
        icon="error"
        text={`Could not determine your location: ${geo.reason}`}
        actionLabel="Retry"
        onAction={() => void runGeoCheck()}
        secondaryActionLabel="Back to Dashboard"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  if (geo.phase === 'blocked') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors['on-surface']} />
          </Pressable>
          <Text style={[Type.headlineSm, { flex: 1 }]} numberOfLines={1}>
            Scan Verification
          </Text>
          <View style={[styles.liveDot, { backgroundColor: Colors.error }]} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <BlockedCard
            geo={geo.geo}
            centreName={centre?.name ?? 'your centre'}
            override={override}
            onPinCentre={pinToCentre}
            onPinFar={pinFarAway}
            onClear={clearOverride}
            onRetry={() => void runGeoCheck()}
            onBack={() => router.back()}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const geoEval = geo.phase === 'ready' ? geo.geo : null;
  const statusPill =
    scan.phase === 'scanning' ? (
      <Pill icon="center-focus-weak" text="SCANNING… AWAITING QR" />
    ) : scan.phase === 'resolving' ? (
      <Pill icon="sync" text="LOOKING UP CANDIDATE…" spinning />
    ) : scan.phase === 'found' ? (
      <Pill icon="check-circle" text={`QR DECODED: ${scan.candidate.rollNo}`} tone="success" />
    ) : (
      <Pill icon="error" text="QR NOT RECOGNISED" tone="error" />
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors['on-surface']} />
        </Pressable>
        <Text style={[Type.headlineSm, { flex: 1 }]} numberOfLines={1}>
          Scan Verification
        </Text>
        <Pressable
          onPress={() => setRapidMode((r) => !r)}
          style={[styles.rapidToggleBtn, rapidMode && styles.rapidToggleBtnActive]}
          hitSlop={8}
        >
          <MaterialIcons
            name={rapidMode ? 'bolt' : 'offline-bolt'}
            size={18}
            color={rapidMode ? '#FFFFFF' : Colors.primary}
          />
          <Text
            style={[
              styles.rapidToggleText,
              rapidMode && styles.rapidToggleTextActive,
            ]}
          >
            {rapidMode ? 'RAPID ON' : 'RAPID'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTorch((t) => !t)}
          style={[styles.torchBtn, torch && styles.torchBtnActive]}
        >
          <MaterialIcons
            name={torch ? 'flash-off' : 'flash-on'}
            size={20}
            color={torch ? Colors['on-primary'] : Colors['on-surface']}
          />
        </Pressable>
        <View style={styles.liveDot} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Feature 6: connectivity / offline queue state */}
        <SyncBanner />
        {/* Camera viewport (design: 4:3, reticle, scanline) */}
        <View style={styles.viewport}>
          {geoEval ? (
            <View style={styles.geoBar}>
              <MaterialIcons
                name="location-on"
                size={14}
                color={override ? Colors['primary-fixed-dim'] : Colors['tertiary-fixed']}
              />
              <Text style={styles.geoBarText}>
                {override ? `${override.label} · ` : ''}
                {formatDistance(geoEval.distanceMeters)} from centre · gate open
              </Text>
            </View>
          ) : null}

          {/* Zoom controls (1x, 1.5x, 2x) */}
          <View style={styles.zoomRow}>
            {[1.0, 1.5, 2.0].map((lvl) => {
              const active = Math.abs(zoom - lvl) < 0.1;
              return (
                <Pressable
                  key={lvl}
                  style={[styles.zoomPill, active && styles.zoomPillActive]}
                  onPress={() => changeZoom(lvl)}
                  hitSlop={6}
                >
                  <Text style={[styles.zoomPillText, active && styles.zoomPillTextActive]}>
                    {lvl}x
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Camera
            ref={cameraRef}
            cameraType={CameraType.Back}
            style={[
              StyleSheet.absoluteFill,
              zoom > 1 ? { transform: [{ scale: zoom }] } : undefined,
            ]}
            scanBarcode={scannerActive}
            showFrame={true}
            laserColor="transparent"
            frameColor="transparent"
            barcodeFrameSize={{ width: 180, height: 180 }}
            onReadCode={
              scannerActive
                ? (event: any) => {
                    const code = event?.nativeEvent?.codeStringValue;
                    if (code) onBarcode({ data: code });
                  }
                : undefined
            }
            torchMode={torch ? 'on' : 'off'}
          />

          {/* Tap-to-focus transparent touch area */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              triggerFocus();
            }}
          />

          {/* Focus Ring Indicator (centered) */}
          {focusing ? (
            <View pointerEvents="none" style={styles.focusRing}>
              <View style={styles.focusRingInner} />
              <Text style={styles.focusingLabel}>FOCUSING…</Text>
            </View>
          ) : null}

          <View style={styles.scanline} pointerEvents="none" />
          <View style={styles.reticle} pointerEvents="none">
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <View key={corner} style={reticleCorners[corner]} />
            ))}
            <MaterialIcons name="center-focus-weak" size={36} color="rgba(255,183,130,0.7)" />
          </View>
          <View style={styles.pillRow} pointerEvents="none">{statusPill}</View>
          {guidance && scan.phase === 'scanning' ? (
            <View style={styles.guidanceBar} pointerEvents="none">
              <MaterialIcons name="tips-and-updates" size={13} color={Colors['primary-fixed-dim']} />
              <Text style={styles.guidanceText} numberOfLines={1}>
                {guidance.message}
              </Text>
            </View>
          ) : null}

          {/* Rapid Gate Mode Floating Success Toast */}
          {rapidBanner ? (
            <View style={styles.rapidSuccessOverlay} pointerEvents="none">
              <View style={styles.rapidSuccessCard}>
                <View style={styles.rapidSuccessIconBox}>
                  <MaterialIcons name="check" size={26} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rapidSuccessTitle}>GATE CLEARED · ADMITTED</Text>
                  <Text style={styles.rapidSuccessName} numberOfLines={1}>
                    {rapidBanner.name}
                  </Text>
                  <Text style={styles.rapidSuccessSubtitle}>
                    {rapidBanner.rollNo}{rapidBanner.room ? ` · ${rapidBanner.room}` : ''}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Quick Focus & Distance Coaching Bar */}
        {scan.phase === 'scanning' ? (
          <Pressable
            style={styles.focusHintBar}
            onPress={() => triggerFocus()}
          >
            <MaterialIcons name="filter-center-focus" size={14} color={Colors['primary-fixed-dim']} />
            <Text style={styles.focusHintText}>
              Hold 15–25 cm away · Tap screen or here to refocus
            </Text>
          </Pressable>
        ) : null}

        {/* Result area */}
        {scan.phase === 'found' ? (
          <FoundCard
            candidate={scan.candidate}
            evaluation={scan.evaluation}
            onNext={reset}
            capturing={capturing}
            captureError={captureError}
            onCapture={handleCapture}
            onManualOverride={handleManualOverride}
            onQuickAdmit={handleQuickAdmit}
          />
        ) : scan.phase === 'not_found' ? (
          <NotFoundCard raw={scan.raw} onRetry={reset} />
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={[Type.bodyMd, { color: Colors.secondary, textAlign: 'center' }]}>
                Point the camera at the QR code on the candidate&apos;s hall ticket.
              </Text>
              {override ? (
                <Pressable onPress={clearOverride} style={styles.overrideChip}>
                  <MaterialIcons name="location-off" size={14} color={Colors.primary} />
                  <Text style={[Type.labelSm, { color: Colors.primary, flex: 1 }]}>
                    {override.label} — tap to return to real GPS
                  </Text>
                </Pressable>
              ) : null}
              {!manualOpen ? (
                <Pressable
                  style={styles.manualLink}
                  onPress={() => setManualOpen(true)}
                >
                  <MaterialIcons name="keyboard" size={16} color={Colors.primary} />
                  <Text style={[Type.labelMd, { color: Colors.primary, flex: 1 }]}>
                    QR unreadable? Enter roll number manually
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {manualFallbackDue ? (
              <ManualEntryCard
                value={manualEntry}
                onChange={setManualEntry}
                onSubmit={() => void submitManualEntry()}
                elapsedSeconds={Math.floor(elapsedMs / 1000)}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ManualEntryCard({
  value,
  onChange,
  onSubmit,
  elapsedSeconds,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  elapsedSeconds: number;
}) {
  return (
    <View style={[styles.card, { borderWidth: 1, borderColor: Colors['primary-fixed-dim'] }]}>
      <View style={styles.errorHead}>
        <View style={[styles.errorIconBox, { backgroundColor: Colors['primary-fixed'] }]}>
          <MaterialIcons name="keyboard" size={22} color={Colors['on-primary-fixed-variant']} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={Type.titleMd}>Trouble reading the code?</Text>
          <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 2 }]}>
            Trying for {elapsedSeconds}s. Flatten the ticket, use the torch — or enter the roll
            number manually. Manual entries go through the same centre &amp; duplicate checks.
          </Text>
        </View>
      </View>
      <View style={styles.manualRow}>
        <TextInput
          style={[styles.manualInput, Type.monoMetric]}
          placeholder="e.g. KAR-24-91000"
          placeholderTextColor={Colors.outline}
          autoCapitalize="characters"
          autoCorrect={false}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          returnKeyType="go"
        />
        <Pressable style={styles.manualSubmit} onPress={onSubmit} disabled={!value.trim()}>
          <MaterialIcons name="arrow-forward" size={18} color={Colors['on-primary']} />
        </Pressable>
      </View>
    </View>
  );
}

function Pill({
  icon,
  text,
  tone,
  spinning,
}: {
  icon: IconName;
  text: string;
  tone?: 'default' | 'success' | 'error';
  spinning?: boolean;
}) {
  const color =
    tone === 'success'
      ? Colors['tertiary-fixed']
      : tone === 'error'
        ? '#ffb4ab'
        : Colors['tertiary-fixed'];
  return (
    <View style={styles.pill}>
      {spinning ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <MaterialIcons name={icon} size={14} color={color} />
      )}
      <Text style={[Type.monoMetric, { color, fontSize: 13 }]}>{text}</Text>
    </View>
  );
}

function BlockedCard({
  geo,
  centreName,
  override,
  onPinCentre,
  onPinFar,
  onClear,
  onRetry,
  onBack,
}: {
  geo: GeofenceEvaluation;
  centreName: string;
  override: LocationOverride | null;
  onPinCentre: () => void;
  onPinFar: () => void;
  onClear: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { borderWidth: 1, borderColor: Colors['error-container'] }]}>
        <View style={styles.blockedHead}>
          <View style={styles.blockedIconBox}>
            <MaterialIcons name="wrong-location" size={26} color={Colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.titleMd, { color: Colors.error }]}>
              You are not at your assigned exam centre
            </Text>
            <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 2 }]}>
              Scanning is disabled until you are within {geo.allowedRadiusMeters} m of{' '}
              {centreName}.
            </Text>
          </View>
        </View>
        <View style={styles.distanceBox}>
          <View style={styles.distanceRow}>
            <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
              YOUR DISTANCE FROM CENTRE
            </Text>
            <Text style={[Type.headlineLg, { color: Colors.error }]}>
              {formatDistance(geo.distanceMeters)}
            </Text>
          </View>
          <View style={styles.distanceRow}>
            <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
              ALLOWED RADIUS
            </Text>
            <Text style={[Type.headlineLg, { color: Colors['on-surface'] }]}>
              {geo.allowedRadiusMeters} m
            </Text>
          </View>
        </View>
        <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
          Location is checked before any candidate lookup — roster data stays inaccessible
          off-site.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={Type.titleSm}>Demo controls (rehearsal only)</Text>
        <Text style={[Type.labelSm, { color: Colors.secondary }]}>
          {override
            ? `Active override: ${override.label}`
            : 'Pin the device location to rehearse the gate without travelling.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[styles.demoBtn, { flex: 1 }]} onPress={onPinCentre}>
            <MaterialIcons name="my-location" size={16} color={Colors['on-primary']} />
            <Text style={[Type.labelMd, { color: Colors['on-primary'] }]}>Pin to centre</Text>
          </Pressable>
          <Pressable
            style={[styles.demoBtn, { flex: 1, backgroundColor: Colors['surface-container'] }]}
            onPress={onPinFar}
          >
            <MaterialIcons name="location-city" size={16} color={Colors.secondary} />
            <Text style={[Type.labelMd, { color: Colors.secondary }]}>Simulate far away</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[styles.demoBtnGhost, { flex: 1 }]} onPress={onRetry}>
            <MaterialIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={[Type.labelMd, { color: Colors.primary }]}>Re-check GPS</Text>
          </Pressable>
          {override ? (
            <Pressable style={[styles.demoBtnGhost, { flex: 1 }]} onPress={onClear}>
              <MaterialIcons name="location-off" size={16} color={Colors.primary} />
              <Text style={[Type.labelMd, { color: Colors.primary }]}>Clear override</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[styles.demoBtnGhost, {}]} onPress={onBack}>
          <MaterialIcons name="dashboard" size={16} color={Colors.secondary} />
          <Text style={[Type.labelMd, { color: Colors.secondary }]}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MismatchBanner({ allottedCentreId }: { allottedCentreId: string }) {
  return (
    <View style={[styles.card, { borderWidth: 1, borderColor: Colors['error-container'] }]}>
      <View style={styles.errorHead}>
        <View style={styles.errorIconBox}>
          <MaterialIcons name="wrong-location" size={22} color={Colors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.titleMd, { color: Colors.error }]}>Centre mismatch — entry blocked</Text>
          <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 2 }]}>
            This candidate is allotted to{' '}
            <Text style={{ fontWeight: '700', color: Colors.error }}>
              {centreDisplayName(allottedCentreId)}
            </Text>
            . Direct them to their correct centre; this attempt has been logged for the audit trail.
          </Text>
        </View>
      </View>
    </View>
  );
}

function DuplicateBanner({ existing }: { existing: ExistingVerification }) {
  const t = new Date(existing.log.timestamp);
  const when = `${t.toLocaleDateString()} ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return (
    <View style={[styles.card, { borderWidth: 1, borderColor: Colors['error-container'] }]}>
      <View style={styles.errorHead}>
        <View style={styles.errorIconBox}>
          <MaterialIcons name="history" size={22} color={Colors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.titleMd, { color: Colors.error }]}>Already verified today</Text>
          <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 2 }]}>
            Original check-in:{' '}
            <Text style={{ fontWeight: '700', color: Colors.error }}>{when}</Text> by{' '}
            <Text style={{ fontWeight: '700', color: Colors.error }}>{existing.verifierLabel}</Text>
            . Re-entry rejected; this duplicate scan has been logged.
          </Text>
        </View>
      </View>
    </View>
  );
}

function FoundCard({
  candidate,
  evaluation,
  onNext,
  capturing,
  captureError,
  onCapture,
  onManualOverride,
  onQuickAdmit,
}: {
  candidate: Candidate;
  evaluation: ScanEvaluation;
  onNext: () => void;
  capturing: boolean;
  captureError: boolean;
  onCapture: (candidate: Candidate) => void;
  onManualOverride: (candidate: Candidate) => void;
  onQuickAdmit: (candidate: Candidate) => void;
}) {
  const router = useRouter();
  const centreCode = candidate.allottedCentreId.replace('centre_', '').toUpperCase();
  const mismatch = evaluation.status === 'centre_mismatch';
  const duplicate = evaluation.status === 'duplicate';
  return (
    <View style={{ gap: 12 }}>
      {mismatch ? <MismatchBanner allottedCentreId={evaluation.allottedCentreId} /> : null}
      {duplicate ? <DuplicateBanner existing={evaluation.existing} /> : null}
      {/* Identity card */}
      <View style={styles.card}>
        <View style={styles.idRow}>
          <View style={styles.photoBox}>
            <Image source={{ uri: candidate.photoUrl }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoTag}>
              <Text style={styles.photoTagText}>Hall Admit</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[Type.headlineSm, { flex: 1 }]} numberOfLines={1}>
                {candidate.name}
              </Text>
              {mismatch ? (
                <View style={[styles.qrValidChip, { backgroundColor: Colors['error-container'] }]}>
                  <MaterialIcons name="warning" size={12} color={Colors.error} />
                  <Text style={[Type.labelSm, { color: Colors['on-error-container'] }]}>
                    Wrong Centre
                  </Text>
                </View>
              ) : duplicate ? (
                <View style={[styles.qrValidChip, { backgroundColor: Colors['error-container'] }]}>
                  <MaterialIcons name="content-copy" size={12} color={Colors.error} />
                  <Text style={[Type.labelSm, { color: Colors['on-error-container'] }]}>
                    Duplicate
                  </Text>
                </View>
              ) : (
                <View style={styles.qrValidChip}>
                  <View style={styles.qrValidDot} />
                  <Text style={[Type.labelSm, { color: Colors['on-secondary-container'] }]}>
                    QR Valid
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.rollRow}>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>ROLL NO:</Text>
              <Text style={[Type.monoMetric, { color: Colors['primary-container'] }]}>
                {candidate.rollNo}
              </Text>
            </View>
            <View style={styles.examBox}>
              <View style={styles.examRow}>
                <MaterialIcons name="assignment-ind" size={14} color={Colors.secondary} />
                <Text style={[Type.titleSm, { flex: 1 }]} numberOfLines={1}>
                  {candidate.examType}
                </Text>
              </View>
              <View style={styles.examRow}>
                <MaterialIcons name="location-on" size={14} color={Colors.secondary} />
                <Text
                  style={[Type.bodySm, { flex: 1, color: Colors['on-surface-variant'] }]}
                  numberOfLines={1}
                >
                  {candidate.allottedCentreId} ({centreCode})
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.badgeGrid}>
          <View style={styles.badge}>
            <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
              ALLOTTED ROOM
            </Text>
            <Text style={Type.titleMd}>{candidate.allottedRoom}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>SESSION</Text>
            <Text
              style={[Type.titleMd, { color: Colors['primary-container'], fontSize: 13 }]}
              numberOfLines={1}
            >
              {candidate.session.replace('Morning Session ', '')}
            </Text>
          </View>
        </View>
      </View>

      {/* Next-step action card — only when the scan is allowed to proceed */}
      {!mismatch && !duplicate ? (
        <View style={styles.card}>
          <Pressable
            style={[styles.primaryAction, capturing && { opacity: 0.7 }]}
            disabled={capturing}
            onPress={() => onCapture(candidate)}
          >
            {capturing ? (
              <ActivityIndicator size="small" color={Colors['on-primary']} />
            ) : (
              <MaterialIcons name="photo-camera" size={20} color={Colors['on-primary']} />
            )}
            <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>
              {capturing ? 'Verifying face on-device…' : 'Capture Live Photo & Auto-Verify'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primaryAction, { backgroundColor: Colors.tertiary, marginTop: 4 }]}
            disabled={capturing}
            onPress={() => onQuickAdmit(candidate)}
          >
            <MaterialIcons name="how-to-reg" size={20} color={Colors['on-tertiary']} />
            <Text style={[Type.titleSm, { color: Colors['on-tertiary'], fontWeight: '700' }]}>
              Admit Candidate · Clear Gate
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            disabled={capturing}
            onPress={() => onManualOverride(candidate)}
          >
            <MaterialIcons name="fingerprint" size={18} color={Colors.secondary} />
            <Text style={[Type.titleSm, { color: Colors['on-surface'] }]}>
              Manual Biometric / Verifier Override
            </Text>
          </Pressable>
          <Pressable
            style={styles.rejectAction}
            disabled={capturing}
            onPress={() =>
              router.push({
                pathname: '/manual-verification',
                params: { candidateId: candidate.candidateId, reason: 'verifier_flag' },
              })
            }
          >
            <MaterialIcons name="person-off" size={18} color={Colors.error} />
            <Text style={[Type.titleSm, { color: Colors.error }]}>
              Reject / Flag Impersonation
            </Text>
          </Pressable>
          {captureError ? (
            <Text style={[Type.labelSm, { color: Colors.error, textAlign: 'center' }]}>
              Capture failed — check camera permission, or use Manual Override.
            </Text>
          ) : null}
          <View style={styles.nextRow}>
            <Pressable style={styles.scanNextBtn} onPress={onNext}>
              <MaterialIcons name="qr-code-scanner" size={18} color={Colors['on-primary']} />
              <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>
                Scan Next Candidate
              </Text>
            </Pressable>
            <Pressable style={styles.dashBtn} onPress={() => router.back()}>
              <Text style={[Type.labelLg, { color: Colors.primary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.nextRow}>
            <Pressable style={styles.scanNextBtn} onPress={onNext}>
              <MaterialIcons name="qr-code-scanner" size={18} color={Colors['on-primary']} />
              <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>
                Scan Next Candidate
              </Text>
            </Pressable>
            <Pressable style={styles.dashBtn} onPress={() => router.back()}>
              <Text style={[Type.labelLg, { color: Colors.primary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function NotFoundCard({ raw, onRetry }: { raw: string; onRetry: () => void }) {
  const router = useRouter();
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { borderColor: Colors['error-container'], borderWidth: 1 }]}>
        <View style={styles.errorHead}>
          <View style={styles.errorIconBox}>
            <MaterialIcons name="search-off" size={22} color={Colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.titleMd, { color: Colors.error }]}>QR not found in system</Text>
            <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 2 }]}>
              This hall ticket is not in today&apos;s candidate roster. Verify the code or
              contact the control room.
            </Text>
          </View>
        </View>
        <View style={styles.rawBox}>
          <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
            SCANNED PAYLOAD
          </Text>
          <Text style={[Type.monoMetric, { fontSize: 13 }]} numberOfLines={2}>
            {raw || '(empty)'}
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <Pressable style={styles.scanNextBtn} onPress={onRetry}>
          <MaterialIcons name="refresh" size={18} color={Colors['on-primary']} />
          <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => router.back()}>
          <MaterialIcons name="dashboard" size={18} color={Colors.secondary} />
          <Text style={[Type.titleSm, { color: Colors['on-surface'] }]}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Centered({
  icon,
  text,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  icon: IconName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.centerWrap}>
        <MaterialIcons name={icon} size={44} color={Colors.outline} />
        <Text style={[Type.bodyLg, { textAlign: 'center', marginTop: 12 }]}>{text}</Text>
        {actionLabel ? (
          <Pressable
            style={[styles.scanNextBtn, { marginTop: 20, minWidth: 240, flex: 0 }]}
            onPress={onAction}
          >
            <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {secondaryActionLabel ? (
          <Pressable style={{ marginTop: 12 }} onPress={onSecondaryAction}>
            <Text style={[Type.labelLg, { color: Colors.primary }]}>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const reticleCorners: Record<'tl' | 'tr' | 'bl' | 'br', ViewStyle> = {
  tl: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2, borderTopColor: Colors['primary-container'], borderLeftColor: Colors['primary-container'], borderTopLeftRadius: Radius.lg },
  tr: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2, borderTopColor: Colors['primary-container'], borderRightColor: Colors['primary-container'], borderTopRightRadius: Radius.lg },
  bl: { position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomColor: Colors['primary-container'], borderLeftColor: Colors['primary-container'], borderBottomLeftRadius: Radius.lg },
  br: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2, borderBottomColor: Colors['primary-container'], borderRightColor: Colors['primary-container'], borderBottomRightRadius: Radius.lg },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  torchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnActive: { backgroundColor: Colors['primary-container'] },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.tertiary },

  content: { padding: 16, paddingBottom: 40, gap: 12 },
  viewport: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 288,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors['inverse-surface'],
    justifyContent: 'flex-end',
  },
  geoBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(42,49,61,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  geoBarText: { ...Type.labelSm, color: Colors['tertiary-fixed'] },
  zoomRow: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(23,28,36,0.85)',
    padding: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  zoomPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  zoomPillActive: {
    backgroundColor: Colors['primary-container'],
  },
  zoomPillText: {
    ...Type.labelSm,
    fontSize: 11,
    color: Colors['outline-variant'],
    fontWeight: '600',
  },
  zoomPillTextActive: {
    color: Colors['on-primary-container'],
    fontWeight: '700',
  },
  focusRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginTop: -32,
    marginLeft: -32,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors['primary-fixed-dim'],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  focusRingInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors['primary-fixed-dim'],
  },
  focusingLabel: {
    position: 'absolute',
    bottom: -22,
    alignSelf: 'center',
    ...Type.labelSm,
    fontSize: 9,
    color: Colors['primary-fixed-dim'],
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  focusHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors['surface-container-low'],
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    alignSelf: 'center',
  },
  focusHintText: {
    ...Type.labelSm,
    color: Colors['outline-variant'],
    fontSize: 11,
  },
  scanline: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 172,
    height: 2,
    marginLeft: -86,
    marginTop: -1,
    backgroundColor: Colors['primary-container'],
    opacity: 0.75,
  },
  reticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 180,
    height: 180,
    marginTop: -90,
    marginLeft: -90,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pillRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 25,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(42,49,61,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  guidanceBar: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217,123,41,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  guidanceText: { ...Type.labelSm, color: Colors['on-primary-container'] },

  card: {
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  blockedHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  blockedIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors['error-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBox: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
  },
  distanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  demoBtn: {
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors['primary-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  demoBtnGhost: {
    height: 40,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors['surface-container-low'],
  },
  overrideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors['primary-fixed-dim'],
    borderRadius: Radius.md,
    padding: 8,
  },

  idRow: { flexDirection: 'row', gap: 16 },
  photoBox: {
    width: 80,
    height: 96,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors['surface-container'],
  },
  photo: { width: '100%', height: '100%' },
  photoTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220,226,243,0.9)',
    paddingVertical: 2,
  },
  photoTagText: { fontSize: 10, textAlign: 'center', textTransform: 'uppercase', fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  qrValidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors['secondary-container'],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  qrValidDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors['primary-container'] },
  rollRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  examBox: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: {
    flex: 1,
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },

  primaryAction: {
    height: 48,
    borderRadius: Radius.xl,
    backgroundColor: Colors['primary-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.9,
  },
  secondaryAction: {
    height: 48,
    borderRadius: Radius.xl,
    backgroundColor: Colors['surface-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectAction: {
    height: 44,
    borderRadius: Radius.xl,
    backgroundColor: Colors['error-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  soonTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  soonTagDim: {
    backgroundColor: Colors['surface-container-high'],
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  nextRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scanNextBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.xl,
    backgroundColor: Colors['primary-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashBtn: { paddingHorizontal: 12 },

  errorHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  errorIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors['error-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rawBox: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 10,
    gap: 2,
  },

  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors['primary-fixed'],
    borderRadius: Radius.md,
    padding: 10,
  },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors['surface-container-low'],
    paddingHorizontal: 12,
    color: Colors['on-surface'],
  },
  manualSubmit: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors['primary-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  rapidToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors['surface-container-high'],
    borderWidth: 1,
    borderColor: Colors['surface-container-highest'],
  },
  rapidToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rapidToggleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors['on-surface'],
  },
  rapidToggleTextActive: {
    color: '#FFFFFF',
  },

  rapidSuccessOverlay: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99,
  },
  rapidSuccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F766E', // rich deep emerald
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    width: '100%',
  },
  rapidSuccessIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rapidSuccessTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#CCFBF1',
  },
  rapidSuccessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  rapidSuccessSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E6FFFA',
    marginTop: 1,
  },
});
