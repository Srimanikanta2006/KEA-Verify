import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, KEA_LOGO_URI, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getAllCandidates } from '@/services/roster';
import { getAllLocalLogs, subscribeScanLogs } from '@/services/scanLogs';
import { SyncBanner } from '@/components/SyncBanner';
import { runSyncNow, useSyncStatus } from '@/services/syncManager';
import type { Candidate, ScanLog } from '@/types/models';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Stat {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: IconName;
  caption: string;
  target: { tab: 'roster' | 'logs'; filter?: string };
}

function StatCard({
  stat,
  total,
  onPress,
}: {
  stat: Stat;
  total: number;
  onPress: (t: Stat['target']) => void;
}) {
  const pct = total > 0 ? ((stat.value / total) * 100).toFixed(1) : '0.0';
  return (
    <Pressable style={styles.statCard} onPress={() => onPress(stat.target)}>
      <View style={styles.statHead}>
        <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
          {stat.label.toUpperCase()}
        </Text>
        <View style={[styles.statIconBox, { backgroundColor: `${stat.color}1A` }]}>
          <MaterialIcons name={stat.icon} size={16} color={stat.color} />
        </View>
      </View>
      <Text style={[Type.headlineLg, { color: stat.color }]}>{stat.value}</Text>
      <View style={styles.statCaption}>
        <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
          {stat.caption} · {pct}%
        </Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [profileVisible, setProfileVisible] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const { online } = useSyncStatus();

  const loadRoster = useCallback(async () => {
    try {
      const [list, logs] = await Promise.all([getAllCandidates(), getAllLocalLogs()]);
      setCandidates(list);
      setScanLogs(logs);
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    void loadRoster();

    // Auto-update smoothly when any scan is recorded anywhere in the app
    const unsub = subscribeScanLogs(() => {
      void loadRoster();
    });

    // Light 2-second background refresh to keep turnout stats live
    const interval = setInterval(() => {
      void loadRoster();
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [session, router, loadRoster]);

  useFocusEffect(
    useCallback(() => {
      void loadRoster();
    }, [loadRoster])
  );

  const stats = useMemo(() => {
    const centreRoster = candidates.filter(
      (x) => x.allottedCentreId === session?.assignedCentreId
    );
    const total = centreRoster.length;
    const admittedIds = new Set(
      scanLogs.filter((l) => l.result === 'matched').map((l) => l.candidateId)
    );
    const present = admittedIds.size;
    const manual = scanLogs.filter(
      (l) => l.result === 'matched' && l.entryMethod === 'manual'
    ).length;
    const face = present - manual;
    const pending = total - present;
    const list: Stat[] = [
      { key: 'allocated', label: 'Allocated', value: total, color: Colors['on-surface'], icon: 'groups', caption: 'Scheduled roster', target: { tab: 'roster' } },
      { key: 'face', label: 'Face Verified', value: face, color: Colors.tertiary, icon: 'camera-front', caption: 'auto-matched', target: { tab: 'logs', filter: 'matched' } },
      { key: 'manual', label: 'Manual Verified', value: manual, color: Colors.secondary, icon: 'how-to-reg', caption: 'verifier cleared', target: { tab: 'logs', filter: 'matched' } },
      { key: 'present', label: 'Present', value: present, color: Colors.tertiary, icon: 'assignment-turned-in', caption: 'total turnout', target: { tab: 'logs', filter: 'matched' } },
      { key: 'pending', label: 'Pending', value: pending, color: Colors.primary, icon: 'hourglass-top', caption: 'awaiting arrival', target: { tab: 'roster' } },
      { key: 'flagged', label: 'Blocked', value: scanLogs.filter((l) => l.result.startsWith('rejected_')).length, color: Colors.error, icon: 'person-off', caption: 'mismatch / duplicate', target: { tab: 'logs', filter: 'rejected_impersonation' } },
    ];
    return list;
  }, [candidates, scanLogs, session?.assignedCentreId]);

  const total = stats[0]?.value ?? 0;
  const present = stats[3]?.value ?? 0;
  const ribbonPct = total > 0 ? (present / total) * 100 : 0;

  const recentActivity = useMemo(() => {
    const rosterMap = new Map(candidates.map((c) => [c.candidateId, c]));
    return [...scanLogs]
      .reverse()
      .slice(0, 3)
      .map((l) => {
        const cand = rosterMap.get(l.candidateId);
        const ok = l.result === 'matched';
        const label =
          l.result === 'matched'
            ? l.entryMethod === 'manual'
              ? 'Manual OK'
              : 'Face Matched'
            : l.result === 'manual_review'
              ? 'Review'
              : 'Blocked';
        const detail =
          l.result === 'rejected_centre_mismatch'
            ? 'wrong centre'
            : l.result === 'rejected_duplicate'
              ? 'duplicate scan'
              : l.result === 'rejected_impersonation'
                ? 'flagged'
                : `${cand?.allottedRoom ?? ''} · ${new Date(l.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`;
        return {
          scanId: l.scanId,
          name: cand?.name ?? l.candidateId,
          rollNo: cand?.rollNo ?? '',
          detail,
          label,
          ok,
        };
      });
  }, [scanLogs, candidates]);

  const handleRefresh = useCallback(async () => {
    await runSyncNow();
    await loadRoster();
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 1500);
  }, [loadRoster]);

  if (!session) return null;
  const centreCode =
    (session.centre as { code?: string }).code ?? session.assignedCentreId.replace('centre_', '').toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={{ uri: KEA_LOGO_URI }}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <Text style={[Type.titleMd, { letterSpacing: -0.2 }]}>KEA VERIFY</Text>
          <View style={styles.liveDot} />
        </View>
        <Pressable onPress={() => setProfileVisible(true)} style={styles.avatarBtn}>
          <MaterialIcons name="person" size={18} color={Colors['on-primary']} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Feature 6: connectivity / offline queue state */}
        <SyncBanner forceShow />
        {/* Centre banner */}
        <View style={styles.card}>
          <View style={styles.bannerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[Type.labelSm, { color: Colors.primary, letterSpacing: 0.8 }]}>
                EXAMINATION AUTHORITY
              </Text>
              <Text style={Type.headlineSm} numberOfLines={1}>
                {session.centre.name} ({centreCode})
              </Text>
            </View>
            <View style={styles.bannerDot} />
          </View>
        </View>

        {/* Gate status */}
        <View style={styles.card}>
          <View style={styles.gateRow}>
            <View style={styles.gateIcon}>
              <MaterialIcons name="sensor-door" size={24} color={Colors.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.gateTitleRow}>
                <Text style={Type.titleSm}>Verification Gate Open</Text>
                <View style={styles.gateDot} />
              </View>
              <Text style={[Type.bodySm, { color: Colors['on-surface-variant'] }]}>
                {total} Candidates Scheduled Today
              </Text>
            </View>
            <Pressable
              style={styles.refreshBtn}
              onPress={() => void handleRefresh()}
              disabled={!online}
            >
              <MaterialIcons
                name={justRefreshed ? 'check-circle' : 'refresh'}
                size={16}
                color={Colors['on-surface']}
              />
              <Text style={[Type.labelSm, { color: Colors['on-surface'] }]}>
                {justRefreshed ? 'Synced' : 'Refresh'}
              </Text>
 </Pressable>
          </View>
          <View style={styles.ribbonWrap}>
            <View style={styles.ribbonLabels}>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>Hall Occupancy</Text>
              <Text style={[Type.monoMetric, { color: Colors.tertiary }]}>
                {present} / {total} ({ribbonPct.toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.ribbonTrack}>
              <View style={[styles.ribbonFill, { backgroundColor: Colors.tertiary, flex: Math.max(ribbonPct, 1) }]} />
              <View style={[styles.ribbonFill, { backgroundColor: Colors['secondary-container'], flex: Math.max(100 - ribbonPct, 1) }]} />
            </View>
          </View>
        </View>

        {/* Stats grid — every card opens the matching Records view */}
        <View style={styles.statGrid}>
          {stats.map((s) => (
            <StatCard
              key={s.key}
              stat={s}
              total={total}
              onPress={(t) =>
                router.push({
                  pathname: '/records',
                  params: { tab: t.tab, ...(t.filter ? { filter: t.filter } : {}) },
                })
              }
            />
          ))}
        </View>

        {/* Recent gate activity — real scan logs, latest first */}
        <View style={styles.card}>
          <View style={styles.activityHead}>
            <Text style={Type.titleMd}>Recent Gate Activity</Text>
            <Pressable onPress={() => router.push('/records?tab=logs')}>
              <Text style={[Type.labelSm, { color: Colors.primary }]}>View All</Text>
            </Pressable>
          </View>
          {recentActivity.map((item) => (
            <View key={item.scanId} style={styles.activityItem}>
              <View style={styles.activityText}>
                <Text style={Type.titleSm} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  {item.rollNo} · {item.detail}
                </Text>
              </View>
              <View
                style={[
                  styles.activityChip,
                  {
                    backgroundColor: item.ok
                      ? 'rgba(0,108,74,0.1)'
                      : Colors['error-container'],
                  },
                ]}
              >
                <Text
                  style={[
                    Type.labelSm,
                    { color: item.ok ? Colors.tertiary : Colors['on-error-container'] },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </View>
          ))}
          {recentActivity.length === 0 ? (
            <Text style={[Type.bodySm, { color: Colors.secondary }]}>
              No verifications yet today — scan a hall ticket to begin.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => router.replace('/dashboard')}>
          <MaterialIcons name="dashboard" size={24} color={Colors.primary} />
          <Text style={[Type.labelSm, { color: Colors.primary, marginTop: 2 }]}>Dashboard</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/records?tab=logs')}>
          <MaterialIcons name="receipt-long" size={24} color={Colors.secondary} />
          <Text style={[Type.labelSm, { color: Colors.secondary, marginTop: 2 }]}>Records</Text>
        </Pressable>
        <Pressable style={styles.scanFab} onPress={() => router.push('/scan')}>
          <MaterialIcons name="qr-code-scanner" size={28} color={Colors['on-primary']} />
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/records?tab=roster')}>
          <MaterialIcons name="badge" size={24} color={Colors.secondary} />
          <Text style={[Type.labelSm, { color: Colors.secondary, marginTop: 2 }]}>Roster</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setProfileVisible(true)}>
          <MaterialIcons name="domain" size={24} color={Colors.secondary} />
          <Text style={[Type.labelSm, { color: Colors.secondary, marginTop: 2 }]}>Centre</Text>
        </Pressable>
      </View>

      {/* Centre/profile modal */}
      <Modal transparent visible={profileVisible} animationType="fade" onRequestClose={() => setProfileVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHead}>
              <MaterialIcons name="domain" size={18} color={Colors.primary} />
              <Text style={[Type.titleMd, { color: Colors.primary, flex: 1 }]}>
                Examination Centre Profile
              </Text>
              <Pressable onPress={() => setProfileVisible(false)}>
                <MaterialIcons name="close" size={20} color={Colors.secondary} />
              </Pressable>
            </View>
            <View style={styles.modalRow}>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>CENTRE / INSTITUTION</Text>
              <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.centre.name}</Text>
              <Text style={[Type.labelSm, { color: Colors.primary }]}>
                Centre Code: {centreCode} ({(session.centre as { district?: string }).district ?? '—'})
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>ACTIVE INVIGILATOR</Text>
              <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.name}</Text>
              <Text style={[Type.labelSm, { color: Colors.secondary }]}>
                {session.verifierId} · {session.role.replace('_', ' ')} · mode: {session.mode}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>ASSIGNED CENTRE ID</Text>
              <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.assignedCentreId}</Text>
              <Text style={[Type.labelSm, { color: Colors.tertiary }]}>
                Session stored locally · persists offline
              </Text>
            </View>
            <Pressable
              style={styles.logoutBtn}
              onPress={async () => {
                setProfileVisible(false);
                await signOut();
                router.replace('/login');
              }}
            >
              <MaterialIcons name="logout" size={18} color={Colors['on-error-container']} />
              <Text style={[Type.titleSm, { color: Colors['on-error-container'] }]}>
                Logout / Exit Session
              </Text>
            </Pressable>
            <Pressable style={styles.dismissBtn} onPress={() => setProfileVisible(false)}>
              <Text style={[Type.labelMd, { color: Colors['on-surface'] }]}>Dismiss</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
    justifyContent: 'space-between',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors['surface-container-lowest'],
    borderWidth: 1,
    borderColor: Colors['surface-container'],
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.tertiary },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 12, paddingTop: 8 },
  card: {
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.tertiary },

  gateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gateIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(0,108,74,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.tertiary },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors['surface-container'],
  },
  ribbonWrap: { marginTop: 14, gap: 4 },
  ribbonLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ribbonTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors['surface-container'],
  },
  ribbonFill: { height: '100%' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statCaption: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },

  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors['surface-container-lowest'],
  },
  chipActive: { backgroundColor: Colors.primary },

  activityHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activityBadge: {
    backgroundColor: Colors['surface-container'],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(240,243,255,0.7)',
    borderRadius: Radius.lg,
    padding: 10,
    marginBottom: 8,
  },
  activityText: { flex: 1, gap: 2 },
  activityChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },

  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    backgroundColor: Colors['surface-container-lowest'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors['surface-container'],
  },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  scanFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors['primary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#d97b29',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    backgroundColor: Colors['surface-container-lowest'],
    padding: 20,
    gap: 12,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalRow: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 12,
    gap: 2,
  },
  logoutBtn: {
    height: 44,
    borderRadius: Radius.xl,
    backgroundColor: Colors['error-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dismissBtn: {
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
