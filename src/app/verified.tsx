import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Type } from '@/constants/theme';
import { findCandidate } from '@/services/roster';
import { SyncBanner } from '@/components/SyncBanner';
import type { Candidate } from '@/types/models';

const AUTO_RETURN_MS = 2500;

export default function VerifiedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ candidateId: string; score?: string; via?: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [remaining, setRemaining] = useState(AUTO_RETURN_MS);
  const raf = useRef<number | null>(null);

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

  // Auto-return countdown (design: 2.5s with progress bar + Skip)
  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = AUTO_RETURN_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(interval);
        router.replace('/scan');
      } else {
        setRemaining(left);
      }
    }, 50);
    return () => {
      if (raf.current) clearTimeout(raf.current);
      clearInterval(interval);
    };
  }, [router]);

  const secondsLeft = (remaining / 1000).toFixed(1);
  const pct = (remaining / AUTO_RETURN_MS) * 100;

  const goScan = () => router.replace('/scan');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        {/* Top row */}
        <View style={styles.topRow}>
          <Pressable style={styles.dashPill} onPress={() => router.replace('/dashboard')}>
            <MaterialIcons name="arrow-back" size={16} color={Colors.secondary} />
            <Text style={[Type.labelSm, { color: Colors.secondary }]}>Dashboard</Text>
          </Pressable>
          <View style={styles.syncPillWrap}>
            <SyncBanner forceShow />
          </View>
        </View>

        {/* Status stack */}
        <View style={styles.statusStack}>
          <View style={styles.badgeOuter}>
            <View style={styles.badgeInner}>
              <MaterialIcons name="check" size={52} color={Colors['on-tertiary']} />
            </View>
          </View>
          <View style={styles.verifiedChip}>
            <View style={styles.verifiedDot} />
            <Text style={[Type.labelMd, { color: Colors['on-tertiary-fixed'], letterSpacing: 1 }]}>
              {params.via === 'manual' ? 'VERIFIER CONFIRMED' : 'IDENTITY VERIFIED'}
            </Text>
          </View>
          <View style={styles.idCard}>
            <Image source={{ uri: candidate?.photoUrl }} style={styles.photo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={[Type.headlineXl, { fontSize: 24 }]} numberOfLines={1}>
                {candidate?.name ?? '…'}
              </Text>
              <Text style={[Type.monoMetric, { color: Colors.secondary, letterSpacing: 2 }]}>
                {candidate?.rollNo ?? ''}
              </Text>
              {params.score ? (
                <Text style={[Type.labelSm, { color: Colors.tertiary, marginTop: 2 }]}>
                  face match {(Number(params.score) * 100).toFixed(1)}%
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Direction block */}
        <View style={styles.directionCard}>
          <View style={styles.proceedRow}>
            <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
            <Text style={[Type.labelLg, { color: Colors.primary, letterSpacing: 1 }]}>
              PROCEED DIRECTLY TO
            </Text>
          </View>
          <View style={styles.roomGrid}>
            <View style={styles.roomBox}>
              <Text style={[Type.labelSm, { color: Colors.secondary }]}>HALL / ROOM</Text>
              <Text style={Type.headlineLg}>{(candidate?.allottedRoom ?? '—').toUpperCase()}</Text>
            </View>
            <View style={styles.seatBox}>
              <Text style={[Type.labelSm, { color: Colors['on-primary-fixed-variant'] }]}>
                ALLOCATED DESK
              </Text>
              <Text style={[Type.headlineLg, { color: Colors['on-primary-fixed'] }]}>
                {(candidate?.allottedSeat ?? '—').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialIcons name="meeting-room" size={16} color={Colors['on-surface-variant']} />
              <Text style={Type.labelMd}>{candidate?.examType?.split(' - ')[0] ?? 'Examination'}</Text>
            </View>
            <View style={styles.dot} />
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={16} color={Colors['on-surface-variant']} />
              <Text style={Type.labelMd} numberOfLines={1}>
                {candidate?.session?.replace('Session ', '') ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Fast-track footer */}
        <View style={styles.footer}>
          <Pressable style={styles.nextBtn} onPress={goScan}>
            <Text style={[Type.titleMd, { color: Colors['on-primary'] }]}>Next Candidate</Text>
            <MaterialIcons name="arrow-forward-ios" size={16} color={Colors['on-primary']} />
          </Pressable>
          <View style={styles.linksRow}>
            <Pressable onPress={() => router.replace('/dashboard')}>
              <Text style={[Type.labelSm, { color: Colors.secondary }]}>Dashboard</Text>
            </Pressable>
            <View style={styles.dot} />
            <Pressable onPress={goScan}>
              <Text style={[Type.labelSm, { color: Colors.secondary }]}>Scan</Text>
            </Pressable>
          </View>
          <View style={styles.timerWrap}>
            <View style={styles.timerLabels}>
              <View style={styles.metaItem}>
                <MaterialIcons name="timer" size={14} color={Colors.secondary} />
                <Text style={[Type.labelSm, { color: Colors.secondary }]}>
                  Auto-returning to scan
                </Text>
              </View>
              <Text style={[Type.monoMetric, { color: Colors['on-surface'] }]}>{secondsLeft}s</Text>
            </View>
            <View style={styles.timerTrack}>
              <View style={[styles.timerFill, { width: `${pct}%` }]} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 16, gap: 20 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dashPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors['surface-container-low'],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  syncPillWrap: { flex: 1, alignItems: 'flex-end' },

  statusStack: { alignItems: 'center', gap: 10 },
  badgeOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(41,166,120,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors['tertiary-fixed'],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  verifiedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.tertiary },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors['surface-container-low'],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  photo: { width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: Colors['surface-container-high'] },

  directionCard: {
    backgroundColor: Colors['surface-container-lowest'],
    borderRadius: Radius.xl,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  proceedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  roomGrid: { flexDirection: 'row', gap: 8 },
  roomBox: {
    flex: 1,
    backgroundColor: Colors['surface-container'],
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  seatBox: {
    flex: 1,
    backgroundColor: Colors['primary-fixed'],
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors['outline-variant'] },

  footer: { alignItems: 'center', gap: 12 },
  nextBtn: {
    width: '100%',
    height: 48,
    borderRadius: Radius.xl,
    backgroundColor: Colors['primary-container'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  linksRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerWrap: { width: '100%', gap: 4 },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors['surface-container-high'],
    overflow: 'hidden',
  },
  timerFill: { height: '100%', backgroundColor: Colors['primary-container'], borderRadius: 3 },
});
