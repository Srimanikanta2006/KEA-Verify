import { MaterialIcons, type IconName } from '@/components/Icon';
import { useRouter } from '@/navigation/router';
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

import { Colors, KEA_LOGO_SOURCE, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AuthError } from '@/services/auth';
import { DEMO_CENTRES, DEMO_VERIFIERS } from '@/services/demoData';
import { useSyncStatus } from '@/services/syncManager';

function FieldRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: IconName;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[Type.labelSm, { color: Colors['on-surface-variant'], marginBottom: 3 }]}>
        {label}
      </Text>
      <View style={styles.fieldRow}>
        <MaterialIcons name={icon} size={18} color={Colors.secondary} />
        <Text
          style={[mono ? styles.fieldValueMono : styles.fieldValue, { flex: 1 }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signInGoogle, signInDemo, session } = useAuth();
  const { online } = useSyncStatus();
  const [busy, setBusy] = useState<'google' | 'invigilator' | null>(null);
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
            : 'Sign-in failed. Please try again or enter as assigned invigilator.'
      );
    } finally {
      setBusy(null);
    }
  };

  const runInvigilatorAuth = async () => {
    setBusy('invigilator');
    setError(null);
    try {
      await signInDemo(verifier.authProviderId);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Official Authority Brand Header */}
        <View style={styles.brandRow}>
          <Image source={KEA_LOGO_SOURCE} style={styles.logoImage} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={Type.titleMd}>Karnataka Examinations Authority</Text>
            <Text style={[Type.bodySm, { color: Colors.secondary }]}>
              KEA Verify · Invigilator Portal
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
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Section 1: Exam Details */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="domain-verification" size={18} color={Colors.primary} />
            <Text style={Type.titleMd}>Section 1: Exam Details</Text>
          </View>

          <FieldRow
            icon="badge"
            label="Exam Type & Cadre"
            value="Civil Police Constable - RPC 2026"
          />

          <FieldRow
            icon="schedule"
            label="Designated Session"
            value="Morning Session (10:30 AM - 12:30 PM)"
          />

          <FieldRow
            icon="apartment"
            label="Assigned Centre / College Code"
            value={`${centre?.code ?? 'AN0081'} · ${centre?.name ?? 'Govt SHVNM Girls PU College'}`}
            mono
          />

          <View style={styles.verifiedTag}>
            <MaterialIcons name="check-circle" size={16} color={Colors['on-tertiary-fixed']} />
            <Text style={[Type.labelSm, { color: Colors['on-tertiary-fixed'], flex: 1 }]}>
              VERIFIED EXAMINATION CENTRE · {centre?.district ?? 'Bengaluru Urban'} ({centre?.code ?? 'AN0081'})
            </Text>
          </View>
        </View>

        {/* Section 2: Verifier Authentication */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <MaterialIcons name="person-pin" size={18} color={Colors.primary} />
            <Text style={Type.titleMd}>Section 2: Verifier Authentication</Text>
          </View>

          <FieldRow
            icon="account-circle"
            label="Invigilator / Verifier Full Name"
            value={verifier?.name ?? 'Darshan S Kalburgi'}
          />

          <FieldRow
            icon="badge"
            label="Designated Verification Desk"
            value="KEA-DESK-AN0081 · Nodal Officer Authorized"
            mono
          />

          <View style={styles.otpNote}>
            <Text style={[Type.labelSm, { color: Colors.secondary }]}>
              Sign in with your registered Google account to access your assigned centre &amp; candidate roster.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error" size={18} color={Colors.error} />
              <Text style={[Type.bodySm, { color: Colors.error, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Primary Action: Google Sign-In */}
        <Pressable
          onPress={runGoogle}
          disabled={busy !== null}
          style={[styles.primaryBtn, busy !== null && { opacity: 0.7 }]}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={Colors['on-primary']} />
          ) : (
            <>
              <MaterialIcons name="login" size={20} color={Colors['on-primary']} />
              <Text style={[Type.titleMd, { color: Colors['on-primary'], fontWeight: '700' }]}>
                Sign in with Google
              </Text>
            </>
          )}
        </Pressable>

        {/* Secondary Action: Direct Authorized Access */}
        <Pressable
          onPress={runInvigilatorAuth}
          disabled={busy !== null}
          style={styles.secondaryBtn}
        >
          {busy === 'invigilator' ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <MaterialIcons name="account-circle" size={18} color={Colors.primary} />
              <Text style={[Type.titleSm, { color: Colors['on-surface'], fontWeight: '600' }]}>
                Enter as Invigilator ({verifier?.name ?? 'Darshan S Kalburgi'})
              </Text>
            </>
          )}
        </Pressable>

        {/* Nodal Officer Support */}
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
              { label: 'BENGALURU URBAN CONTROL ROOM', value: '080-23460460 / 23460461' },
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
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  logoImage: { width: 44, height: 44, borderRadius: 22 },
  onlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors['outline-variant'],
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fieldBlock: {
    gap: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
  },
  fieldValue: { ...Type.bodyMd, color: Colors['on-surface'] },
  fieldValueMono: { ...Type.bodyMd, color: Colors['on-surface'], fontFamily: 'monospace' },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: Colors['tertiary-fixed'],
    borderRadius: Radius.md,
    marginTop: 4,
  },
  otpNote: {
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: Colors['error-container'],
    borderRadius: Radius.md,
    marginTop: 6,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  secondaryBtn: {
    backgroundColor: Colors['surface-container-low'],
    borderWidth: 1,
    borderColor: Colors['outline-variant'],
    paddingVertical: 12,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    gap: 14,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors['outline-variant'],
    paddingBottom: 10,
  },
  modalRow: {
    gap: 2,
  },
});
