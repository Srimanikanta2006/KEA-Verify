import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, KEA_LOGO_URI, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getAllCandidates } from '@/services/roster';
import { getAllLocalLogs } from '@/services/scanLogs';
import { SyncBanner } from '@/components/SyncBanner';
import type { Candidate, ScanLog } from '@/types/models';

type Tab = 'roster' | 'logs';

const RESULT_META: Record<string, { label: string; bg: string; fg: string }> = {
  matched: { label: 'Face Matched', bg: 'rgba(0,108,74,0.1)', fg: Colors.tertiary },
  manual_review: { label: 'Manual Review', bg: 'rgba(211,123,41,0.15)', fg: Colors.primary },
  rejected_centre_mismatch: {
    label: 'Wrong Centre',
    bg: Colors['error-container'],
    fg: Colors['on-error-container'],
  },
  rejected_duplicate: {
    label: 'Duplicate',
    bg: Colors['error-container'],
    fg: Colors['on-error-container'],
  },
  rejected_impersonation: {
    label: 'Flagged',
    bg: Colors['error-container'],
    fg: Colors['on-error-container'],
  },
};

function resultMeta(r: string) {
  return RESULT_META[r] ?? { label: r, bg: Colors['surface-container'], fg: Colors.secondary };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${d.toLocaleDateString()}`;
}

export default function RecordsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>(params.tab === 'logs' ? 'logs' : 'roster');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [search, setSearch] = useState('');
  const [logFilter, setLogFilter] = useState<string>(params.filter ?? 'all');

  useEffect(() => {
    if (!session) {
      router.replace('/login');
    }
  }, [session, router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [c, l] = await Promise.all([getAllCandidates(), getAllLocalLogs()]);
      if (!alive) return;
      setCandidates(c);
      setLogs(l);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const centreRoster = useMemo(
    () => candidates.filter((x) => x.allottedCentreId === session?.assignedCentreId),
    [candidates, session]
  );

  const rosterMap = useMemo(() => {
    const m = new Map<string, Candidate>();
    centreRoster.forEach((c) => m.set(c.candidateId, c));
    return m;
  }, [centreRoster]);

  const rooms = useMemo(
    () => ['all', ...Array.from(new Set(centreRoster.map((c) => c.allottedRoom))).sort()],
    [centreRoster]
  );

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return centreRoster.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.rollNo.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [centreRoster, search]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...logs]
      .reverse()
      .filter((l) => (logFilter === 'all' ? true : l.result === logFilter))
      .filter((l) => {
        if (!q) return true;
        const cand = rosterMap.get(l.candidateId);
        return (
          l.candidateId.toLowerCase().includes(q) ||
          (cand?.name.toLowerCase().includes(q) ?? false) ||
          (cand?.rollNo.toLowerCase().includes(q) ?? false)
        );
      });
  }, [logs, logFilter, search, rosterMap]);

  const shareCsv = useCallback(async () => {
    const header =
      'rollNo,name,result,time,faceMatchScore,entryMethod,verifier,deviceLat,deviceLng,notes';
    const rows = [...logs]
      .reverse()
      .map((l) => {
        const cand = rosterMap.get(l.candidateId);
        return [
          cand?.rollNo ?? l.candidateId,
          cand?.name ?? '-',
          l.result,
          new Date(l.timestamp).toISOString(),
          l.faceMatchScore !== null && l.faceMatchScore !== undefined ? l.faceMatchScore.toFixed(4) : '',
          l.entryMethod ?? 'qr',
          l.verifierId,
          l.deviceLat ?? '',
          l.deviceLng ?? '',
          (l.notes ?? '').replace(/"/g, '""'),
        ]
          .map((v) => `"${String(v)}"`)
          .join(',');
      });
    const csv = [header, ...rows].join('\n');
    try {
      const file = new File(Paths.cache, 'kea-scan-logs.csv');
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'KEA Verify — scan logs',
        });
      }
    } catch {
      // sharing unavailable — silent, export is best-effort
    }
  }, [logs, rosterMap]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors['on-surface']} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={Type.headlineSm}>Records &amp; Roster</Text>
          <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]} numberOfLines={1}>
            {session.centre.name} · {(session.centre as { code?: string }).code ?? ''}
          </Text>
        </View>
        <Image source={{ uri: KEA_LOGO_URI }} style={styles.logo} contentFit="cover" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner forceShow />

        {/* Search + export */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={Colors.outline} />
            <TextInput
              style={[styles.searchInput, Type.bodySm]}
              placeholder="Search name, roll no…"
              placeholderTextColor={Colors.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable style={styles.exportBtn} onPress={() => void shareCsv()}>
            <MaterialIcons name="ios-share" size={16} color={Colors['on-primary']} />
            <Text style={[Type.labelSm, { color: Colors['on-primary'] }]}>Export</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(
            [
              { key: 'roster' as Tab, label: `Roster (${centreRoster.length})` },
              { key: 'logs' as Tab, label: `Scan Log (${logs.length})` },
            ]
          ).map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[Type.labelMd, { color: tab === t.key ? Colors['on-primary'] : Colors.secondary }]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'roster' ? (
          <>
            {/* Room filter chips */}
            <View style={styles.chipRow}>
              {rooms.slice(0, 9).map((room) => {
                const active = room === 'all' ? search === '' : search === room;
                return (
                  <Pressable
                    key={room}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSearch(room === 'all' ? '' : room)}
                  >
                    <Text
                      style={[
                        Type.labelSm,
                        { color: active ? Colors['on-primary'] : Colors['on-surface-variant'] },
                      ]}
                    >
                      {room === 'all' ? 'All Rooms' : room}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {filteredRoster.map((c) => (
              <View key={c.candidateId} style={styles.rowCard}>
                <Image source={{ uri: c.photoUrl }} style={styles.rowPhoto} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={Type.titleSm} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]} numberOfLines={1}>
                    {c.rollNo} · {c.allottedRoom} · {c.allottedSeat}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
              </View>
            ))}
            {filteredRoster.length === 0 ? (
              <Text style={[Type.bodySm, { color: Colors.secondary, textAlign: 'center', padding: 16 }]}>
                No candidates match your search.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {/* Result filter chips */}
            <View style={styles.chipRow}>
              {['all', 'matched', 'manual_review', 'rejected_centre_mismatch', 'rejected_duplicate', 'rejected_impersonation'].map(
                (f) => (
                  <Pressable
                    key={f}
                    style={[styles.chip, logFilter === f && styles.chipActive]}
                    onPress={() => setLogFilter(f)}
                  >
                    <Text
                      style={[
                        Type.labelSm,
                        { color: logFilter === f ? Colors['on-primary'] : Colors['on-surface-variant'] },
                      ]}
                    >
                      {f === 'all' ? 'All' : resultMeta(f).label}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            {filteredLogs.map((l) => {
              const cand = rosterMap.get(l.candidateId);
              const meta = resultMeta(l.result);
              return (
                <View key={l.scanId} style={styles.rowCard}>
                  <View style={[styles.resultChip, { backgroundColor: meta.bg }]}>
                    <Text style={[Type.labelSm, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={Type.titleSm} numberOfLines={1}>
                      {cand?.name ?? l.candidateId}
                    </Text>
                    <Text
                      style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}
                      numberOfLines={1}
                    >
                      {l.result === 'matched' ? 'Admitted' : 'Blocked / flagged'} ·{' '}
                      {formatTime(l.timestamp)}
                      {l.entryMethod === 'manual' ? ' · manual entry' : ''}
                    </Text>
                  </View>
                  {typeof l.faceMatchScore === 'number' ? (
                    <Text style={[Type.monoMetric, { fontSize: 12, color: Colors.secondary }]}>
                      {(l.faceMatchScore * 100).toFixed(0)}%
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {filteredLogs.length === 0 ? (
              <Text style={[Type.bodySm, { color: Colors.secondary, textAlign: 'center', padding: 16 }]}>
                No scan activity yet — verified candidates appear here.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
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
    gap: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors['surface-container-lowest'],
  },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: Colors['on-surface'] },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors['primary-container'],
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    height: 44,
  },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: {
    flexGrow: 1,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors['surface-container-low'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors['surface-container-lowest'],
  },
  chipActive: { backgroundColor: Colors.primary },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 12,
  },
  rowPhoto: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors['surface-container'] },
  resultChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 110,
    alignSelf: 'flex-start',
  },
});
