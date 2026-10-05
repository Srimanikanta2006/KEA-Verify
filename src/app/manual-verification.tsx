import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, KEA_LOGO_URI, Radius, Type } from '@/constants/theme';
import { recordScan } from '@/services/scanLogs';
import { useAuth } from '@/context/AuthContext';
import { findCandidate } from '@/services/roster';
import { getLastKnownFix } from '@/services/geofence';
import { buildDemoSession } from '@/services/auth';
import type { Candidate } from '@/types/models';

const DISPARITY_REASONS = [
  'Beard / Hairstyle change',
  'Glasses worn',
  'Lighting issue',
  'Mark on face',
];

export default function ManualVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    candidateId: string;
    score?: string;
    liveUri?: string;
    reason?: string;
  }>();
  const { session } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.candidateId) return;
    let alive = true;
    findCandidate(params.candidateId).then((c) => {
      if (alive) setCandidate(c);
    });
    return () => {
      alive = false;
    };
  }, [params.candidateId]);

  const score = useMemo(() => {
    if (!params.score) return null;
    const v = Number(params.score);
    return Number.isFinite(v) ? v : null;
  }, [params.score]);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [disparityWarning, setDisparityWarning] = useState<string | null>(null);

  const activeSession = session ?? buildDemoSession('nodal.kalburgi@kea.kar.nic.in');

  const toggleReason = (reason: string) => {
    setDisparityWarning(null);
    setSelected((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleAdmit = async () => {
    if (!candidate || busy) return;
    // Audit discipline: a low-score manual admit MUST record why.
    if (score !== null && score < 0.75 && selected.length === 0) {
      setDisparityWarning(
        'Please select at least one disparity factor below (glasses, lighting, etc.) before confirming.'
      );
      return;
    }
    setDisparityWarning(null);
    setBusy(true);
    try {
      const fix = getLastKnownFix();
      await recordScan({
        candidate,
        session: activeSession,
        result: 'matched',
        deviceLat: fix?.lat ?? null,
        deviceLng: fix?.lng ?? null,
        faceMatchScore: score,
        notes:
          params.reason === 'verifier_override'
            ? `Manual override admit by verifier (no biometric score)${
                selected.length ? ` — ${selected.join(', ')}` : ''
              }`
            : `Manual confirm of uncertain match (${(
                (score ?? 0) * 100
              ).toFixed(1)}%)${selected.length ? ` — ${selected.join(', ')}` : ''}`,
      });
      router.replace({
        pathname: '/verified',
        params: { candidateId: candidate.candidateId, via: 'manual' },
      });
    } finally {
      setBusy(false);
    }
  };

  const executeReject = async () => {
    if (!candidate || busy) return;
    setRejectModalVisible(false);
    setBusy(true);
    try {
      const fix = getLastKnownFix();
      await recordScan({
        candidate,
        session: activeSession,
        result: 'rejected_impersonation',
        deviceLat: fix?.lat ?? null,
        deviceLng: fix?.lng ?? null,
        faceMatchScore: score,
        entryMethod: params.reason === 'verifier_override' ? 'manual' : 'qr',
        notes: `REJECTED: flagged impersonation${
          selected.length ? ` — ${selected.join(', ')}` : ' — no disparity recorded'
        }`,
      });
      router.replace('/dashboard');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    if (!candidate || busy) return;
    setRejectModalVisible(true);
  };

  if (!candidate) {
    return (
      <SafeAreaView style={styles.safe}>
        <CenterSpinner />
      </SafeAreaView>
    );
  }

  const backTarget = params.reason === 'verifier_override' ? '/scan' : '/scan';

  const scorePct = score !== null ? `${(score * 100).toFixed(0)}%` : 'N/A';
  const centreCode =
    (session?.centre as { code?: string } | undefined)?.code ??
    session?.assignedCentreId.replace('centre_', '').toUpperCase() ??
    '—';
  const now = new Date();
  const liveTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace(backTarget)} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors['on-surface']} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={Type.headlineSm}>Candidate Details</Text>
          <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
            KEA Invigilator Field Desk
          </Text>
        </View>
        <Image source={{ uri: KEA_LOGO_URI }} style={styles.logo} contentFit="cover" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Uncertainty banner */}
        <View style={styles.uncertainBanner}>
          <MaterialIcons name="warning" size={20} color={Colors.error} />
          <Text style={[Type.titleSm, { color: Colors['on-error-container'], flex: 1 }]} numberOfLines={1}>
            {score !== null
              ? `Uncertain match (${scorePct}) — confirm manually.`
              : 'Manual verification required — confirm identity.'}
          </Text>
        </View>

        {/* Identity record */}
        <View style={styles.card}>
          <View style={styles.idHead}>
            <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>IDENTITY RECORD</Text>
            <View style={styles.roomChip}>
              <Text style={[Type.labelSm, { color: Colors['on-surface'] }]}>
                {(candidate.allottedRoom || 'ROOM —').toUpperCase()} /{' '}
                {(candidate.allottedSeat || 'DESK —').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={Type.headlineMd} numberOfLines={2}>
            {candidate.name}
          </Text>
          <View style={styles.rollRow}>
            <Text style={[Type.labelMd, { color: Colors['on-surface-variant'] }]}>Roll No:</Text>
            <Text style={[Type.monoMetric, { color: Colors.primary }]}>{candidate.rollNo}</Text>
          </View>
        </View>

        {/* Biometric cross-check */}
        <View style={styles.card}>
          <Text style={Type.titleSm}>Biometric Cross-Check</Text>
          <View style={styles.photoGrid}>
            <View style={styles.photoCell}>
              <View style={styles.photoFrame}>
                <Image source={{ uri: candidate.photoUrl }} style={styles.photo} contentFit="cover" />
                <View style={[styles.photoTag, styles.photoTagDark]}>
                  <Text style={styles.photoTagText}>KEA REF PHOTO</Text>
                </View>
              </View>
              <Text style={Type.labelMd} numberOfLines={1}>Application File</Text>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]} numberOfLines={1}>
                KEA Central DB Sync
              </Text>
            </View>
            <View style={styles.photoCell}>
              <View style={styles.photoFrame}>
                {params.liveUri ? (
                  <Image source={{ uri: params.liveUri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]}>
                    <MaterialIcons name="person-off" size={32} color={Colors.outline} />
                    <Text style={[Type.labelSm, { color: Colors.outline, marginTop: 4 }]}>
                      No live capture
                    </Text>
                  </View>
                )}
                <View style={[styles.photoTag, styles.photoTagSaffron]}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.photoTagText, { color: Colors['on-primary-container'] }]}>
                    LIVE GATE
                  </Text>
                </View>
              </View>
              <Text style={Type.labelMd} numberOfLines={1}>Gate Scanner</Text>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]} numberOfLines={1}>
                Today · Centre {centreCode}
              </Text>
            </View>
          </View>
          <View style={styles.checklist}>
            <CheckRow icon="check-circle" label="QR Verified" ok />
            <CheckRow icon="check-circle" label="Room Assignment" ok />
            <CheckRow icon="error" label="Face Match" value={scorePct} ok={false} />
          </View>
        </View>

        {/* Audit reason */}
        <View style={styles.card}>
          <View style={styles.reasonHead}>
            <Text style={Type.titleSm}>Audit Reason for Manual Decision</Text>
            <Text style={[Type.labelSm, { color: Colors.primary }]}>REQUIRED *</Text>
          </View>
          <Text style={[Type.bodySm, { color: Colors['on-surface-variant'] }]}>
            Select verified physical disparity factors:
          </Text>
          <View style={styles.chipGrid}>
            {DISPARITY_REASONS.map((reason) => {
              const active = selected.includes(reason);
              return (
                <Pressable
                  key={reason}
                  onPress={() => toggleReason(reason)}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                >
                  <Text
                    style={[Type.labelMd, { color: active ? Colors['on-primary-container'] : Colors['on-surface'], flex: 1 }]}
                  >
                    {reason}
                  </Text>
                  <MaterialIcons
                    name="check"
                    size={18}
                    color={active ? Colors['on-primary-container'] : 'transparent'}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {disparityWarning ? (
          <View style={styles.warningBox}>
            <MaterialIcons name="warning" size={18} color={Colors.error} />
            <Text style={[Type.bodySm, { color: Colors.error, flex: 1 }]}>
              {disparityWarning}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <Pressable
          style={[styles.admitBtn, busy && { opacity: 0.7 }]}
          disabled={busy}
          onPress={handleAdmit}
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors['on-tertiary']} />
          ) : (
            <MaterialIcons name="how-to-reg" size={20} color={Colors['on-tertiary']} />
          )}
          <Text style={[Type.titleSm, { color: Colors['on-tertiary'] }]}>
            Confirm Match &amp; Admit Candidate
          </Text>
        </Pressable>
        <Pressable style={styles.rejectBtn} disabled={busy} onPress={handleReject}>
          <MaterialIcons name="person-off" size={20} color={Colors['on-error-container']} />
          <Text style={[Type.titleSm, { color: Colors['on-error-container'] }]}>
            Reject / Flag Impersonation
          </Text>
        </Pressable>

        <Text style={[Type.labelSm, { color: 'rgba(85,67,55,0.8)', textAlign: 'center', paddingVertical: 8 }]}>
          Logged by {activeSession?.name ?? 'Verifier'} ({activeSession?.verifierId ?? '—'}) ·{' '}
          {candidate.allottedRoom}
        </Text>
      </ScrollView>

      {/* Confirmation modal for Rejection */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <View style={styles.modalIconBox}>
                <MaterialIcons name="person-off" size={24} color={Colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Type.titleMd, { color: Colors.error }]}>Flag Impersonation &amp; Reject?</Text>
                <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 4 }]}>
                  Candidate {candidate.name} (Roll {candidate.rollNo}) will be permanently marked as blocked and transferred to the Chief Superintendent queue.
                </Text>
              </View>
            </View>

            {selected.length > 0 ? (
              <View style={styles.disparitySummary}>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  Recorded Disparity: {selected.join(', ')}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                disabled={busy}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[Type.titleSm, { color: Colors['on-surface'] }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmRejectBtn}
                disabled={busy}
                onPress={() => void executeReject()}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={Colors['on-error']} />
                ) : (
                  <>
                    <MaterialIcons name="block" size={18} color={Colors['on-error']} />
                    <Text style={[Type.titleSm, { color: Colors['on-error'] }]}>
                      Confirm &amp; Reject
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CheckRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value?: string;
  ok: boolean;
}) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkLabel}>
        <MaterialIcons
          name={icon}
          size={18}
          color={ok ? Colors.tertiary : Colors['primary-container']}
        />
        <Text style={[Type.bodySm, { flex: 1 }]}>{label}</Text>
      </View>
      <View
        style={[
          styles.checkBadge,
          { backgroundColor: ok ? 'rgba(0,108,74,0.1)' : 'rgba(211,123,41,0.2)' },
        ]}
      >
        <Text
          style={[
            Type.labelSm,
            { color: ok ? Colors.tertiary : Colors.primary, fontWeight: '700' },
          ]}
        >
          {ok ? '✓' : value}
        </Text>
      </View>
    </View>
  );
}

function CenterSpinner() {
  return (
    <View style={styles.centerWrap}>
      <ActivityIndicator size="large" color={Colors['primary-container']} />
      <Text style={[Type.bodySm, { color: Colors.secondary, marginTop: 8 }]}>Loading candidate…</Text>
    </View>
  );
}

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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors['surface-container-lowest'] },

  content: { padding: 16, paddingBottom: 40, gap: 12 },
  uncertainBanner: {
    backgroundColor: Colors['error-container'],
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

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
  idHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomChip: {
    backgroundColor: Colors['surface-container-high'],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rollRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  photoGrid: { flexDirection: 'row', gap: 8 },
  photoCell: { flex: 1, gap: 4 },
  photoFrame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors['surface-dim'],
    marginBottom: 4,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoTagDark: { backgroundColor: 'rgba(42,49,61,0.8)' },
  photoTagSaffron: { backgroundColor: Colors['primary-container'] },
  photoTagText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, color: Colors['inverse-on-surface'] },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors['surface-container-lowest'] },

  checklist: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 8,
    gap: 8,
  },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  checkBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },

  reasonHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 10,
  },
  reasonChipActive: { backgroundColor: Colors['primary-container'] },

  admitBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.tertiary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors['error-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors['error-container'],
    borderRadius: Radius.md,
    padding: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors['error-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparitySummary: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    justifyContent: 'center',
  },
});
