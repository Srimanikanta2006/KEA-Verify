import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { AuthError } from '@/services/auth';
import { DEMO_CENTRES, DEMO_VERIFIERS } from '@/services/demoData';
import { useSyncStatus } from '@/services/syncManager';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function FieldRow({
  icon,
  value,
  mono,
}: {
  icon: IconName;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <MaterialIcons name={icon} size={20} color={Colors.secondary} />
      <Text
        style={[mono ? styles.fieldValueMono : styles.fieldValue, { flex: 1 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signInGoogle, signInDemo, session } = useAuth();
  const { online } = useSyncStatus();
  const [busy, setBusy] = useState<'google' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportVisible, setSupportVisible] = useState(false);

  const verifier = DEMO_VERIFIERS[0];
  const centre = DEMO_CENTRES.find((ct) => ct.centreId === verifier?.assignedCentreId);

  React.useEffect(() => {
    if (session) router.replace('/dashboard');
  }, [session, router]);

  const runGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      await signInGoogle();
      router.replace('/dashboard');
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Sign-in failed.'
      );
    } finally {
      setBusy(null);
    }
  };

  const runDemo = async () => {
    setBusy('demo');
    setError(null);
    try {
      await signInDemo(verifier.authProviderId);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand header */}
        <View style={styles.brandRow}>
          <Image source={{ uri: KEA_LOGO_URI }} style={styles.logoImage} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={Type.titleMd}>Karnataka Examinations Authority</Text>
            <Text style={[Type.bodySm, { color: Colors.secondary }]}>
              KEA Verify · Exam Verification Desk
            </Text>
          </View>
        </View>

        {/* App identity + live network status */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.identityIcon}>
              <MaterialIcons name="verified-user" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={Type.headlineSm}>KEA Verify</Text>
              <Text style={[Type.bodySm, { color: Colors.secondary }]}>
                Exam Centre Verification System
              </Text>
            </View>
            <View
              style={[
                styles.onlineChip,
                { backgroundColor: online ? Colors['tertiary-fixed'] : Colors['primary-fixed'] },
              ]}
            >
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: online ? Colors.tertiary : Colors['primary-container'] },
                ]}
              />
              <Text
                style={[
                  Type.labelSm,
                  { color: online ? Colors['on-tertiary-fixed'] : Colors['on-primary-fixed-variant'] },
                ]}
              >
                {online ? 'Online' : 'Offline Ready'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 1: Exam & centre details (static exam config) */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="domain-verification" size={18} color={Colors.primary} />
            <Text style={Type.titleMd}>Section 1: Exam Details</Text>
          </View>
          <Text style={[Type.labelMd, { color: Colors['on-surface-variant'], marginBottom: 6 }]}>
            Exam Type &amp; Cadre
          </Text>
          <FieldRow icon="badge" value="Civil Police Constable - RPC 2026" />
          <Text style={[Type.labelMd, { color: Colors['on-surface-variant'], marginBottom: 6 }]}>
            Designated Session
          </Text>
          <FieldRow icon="schedule" value="Morning Session (10:30 AM - 12:30 PM)" />
          <Text style={[Type.labelMd, { color: Colors['on-surface-variant'], marginBottom: 6 }]}>
            Assigned Centre / College Code
          </Text>
          <FieldRow icon="apartment" value={centre?.code ?? 'AN0081'} mono />
          <View style={styles.verifiedTag}>
            <MaterialIcons name="check-circle" size={18} color={Colors['on-tertiary-fixed']} />
            <View style={{ flex: 1 }}>
              <Text style={[Type.labelSm, { color: Colors['on-tertiary-fixed'] }]}>
                VERIFIED EXAMINATION CENTRE
              </Text>
              <Text style={[Type.titleSm, { color: Colors['on-tertiary-fixed-variant'] }]}>
                {centre?.name ?? 'Govt SHVNM Girls PU College'}, {centre?.district ?? 'Bengaluru Urban'} (
                {centre?.code ?? 'AN0081'})
              </Text>
            </View>
          </View>
        </View>

        {/* Section 2: Verifier authentication */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="person-pin" size={18} color={Colors.primary} />
            <Text style={Type.titleMd}>Section 2: Verifier Authentication</Text>
          </View>
          <Text style={[Type.labelMd, { color: Colors['on-surface-variant'], marginBottom: 6 }]}>
            Invigilator / Verifier Full Name
          </Text>
          <FieldRow icon="account-circle" value={verifier.name} />
          <Text style={[Type.labelMd, { color: Colors['on-surface-variant'], marginBottom: 6 }]}>
            Authorized Google Account
          </Text>
          <FieldRow icon="mail" value={verifier.authProviderId} mono />
          <View style={styles.otpNote}>
            <Text style={[Type.labelSm, { color: Colors.secondary }]}>
              Sign in with your registered Google account to access your assigned centre &amp;
              candidate roster.
            </Text>
          </View>
          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error" size={18} color={Colors.error} />
              <Text style={[Type.bodySm, { color: Colors.error, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Auth actions */}
        <Pressable
          onPress={runGoogle}
          disabled={busy !== null}
          style={[styles.primaryBtn, busy !== null && { opacity: 0.7 }]}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={Colors['on-primary']} />
          ) : (
            <>
              <MaterialIcons name="login" size={18} color={Colors['on-primary']} />
              <Text style={[Type.titleMd, { color: Colors['on-primary'] }]}>
                Sign in with Google (Verifier oAuth)
              </Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={runDemo} disabled={busy !== null} style={styles.secondaryBtn}>
          {busy === 'demo' ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <MaterialIcons name="pin" size={18} color={Colors.primary} />
          )}
          <Text style={[Type.labelLg, { color: Colors.primary }]}>
            Continue in Demo Mode (Offline Roster)
          </Text>
        </Pressable>

        <View style={styles.card}>
          <Pressable onPress={() => setSupportVisible(true)} style={styles.supportRow}>
            <MaterialIcons name="support-agent" size={18} color={Colors.outline} />
            <Text style={[Type.bodySm, { color: Colors.secondary, flex: 1 }]}>
              Need help? Contact District Nodal Officer (Control Room)
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, Type.bodySm, { color: 'rgba(87,94,112,0.7)' }]}>
          Official Examination Authority of Karnataka · Secure Invigilator Portal
        </Text>
      </ScrollView>

      {/* Nodal support modal */}
      <Modal
        transparent
        visible={supportVisible}
        animationType="fade"
        onRequestClose={() => setSupportVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSupportVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHead}>
              <MaterialIcons name="support-agent" size={18} color={Colors.primary} />
              <Text style={[Type.titleMd, { color: Colors.primary, flex: 1 }]}>
                KEA District Nodal Desk
              </Text>
              <Pressable onPress={() => setSupportVisible(false)}>
                <MaterialIcons name="close" size={20} color={Colors.secondary} />
              </Pressable>
            </View>
            {[
              { label: 'BANGALORE URBAN CONTROL ROOM', value: '080-23460460 / 23460461' },
              { label: 'CHIEF SUPERINTENDENT HELPLINE', value: '+91 94808 12345' },
              {
                label: 'CENTRE AN0081 TECHNICAL COORDINATOR',
                value: 'Venkatesh Murthy (Tech Lead) · +91 98450 71203',
              },
            ].map((row) => (
              <View key={row.label} style={styles.modalRow}>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  {row.label}
                </Text>
                <Text style={[Type.bodySm, { color: Colors['on-surface'] }]}>{row.value}</Text>
              </View>
            ))}
            <Pressable style={styles.modalCloseBtn} onPress={() => setSupportVisible(false)}>
              <Text style={[Type.titleSm, { color: Colors['on-primary'] }]}>
                Close Support Desk
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors['surface-container-lowest'],
    borderWidth: 1,
    borderColor: Colors['surface-container'],
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(211,123,41,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },

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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 12,
  },
  fieldValue: Type.titleSm,
  fieldValueMono: { ...Type.monoMetric, letterSpacing: 1 },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(133,248,196,0.3)',
    borderRadius: Radius.md,
    padding: 10,
  },
  otpNote: { marginTop: 2 },

  primaryBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors['primary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors['error-container'],
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 8,
  },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },

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
  modalCloseBtn: {
    height: 44,
    borderRadius: Radius.xl,
    backgroundColor: Colors['primary-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { textAlign: 'center', paddingVertical: 8 },
});
