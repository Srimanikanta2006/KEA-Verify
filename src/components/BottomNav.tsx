import { MaterialIcons } from '@/components/Icon';
import { Colors, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/navigation/router';
import { getPendingCount, runSyncNow } from '@/services/syncManager';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type BottomNavTab = 'dashboard' | 'records' | 'roster' | 'scan' | 'centre';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onTabSelect?: (tab: 'records' | 'roster') => void;
}

export function BottomNav({ activeTab, onTabSelect }: BottomNavProps) {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [profileVisible, setProfileVisible] = useState(false);
  const [unsyncedModalVisible, setUnsyncedModalVisible] = useState(false);
  const [pendingUnsynced, setPendingUnsynced] = useState(0);

  const handleNav = (tab: BottomNavTab) => {
    if (tab === 'dashboard') {
      if (activeTab !== 'dashboard') {
        router.replace('/dashboard');
      }
    } else if (tab === 'records') {
      if (onTabSelect) {
        onTabSelect('records');
      } else {
        router.push('/records?tab=logs');
      }
    } else if (tab === 'roster') {
      if (onTabSelect) {
        onTabSelect('roster');
      } else {
        router.push('/records?tab=roster');
      }
    } else if (tab === 'scan') {
      router.push('/scan');
    } else if (tab === 'centre') {
      setProfileVisible(true);
    }
  };

  const handleAttemptLogout = async () => {
    setProfileVisible(false);
    const pending = await getPendingCount();
    if (pending > 0) {
      setPendingUnsynced(pending);
      setUnsyncedModalVisible(true);
    } else {
      await signOut();
      router.replace('/login');
    }
  };

  const centreCode = session?.centre?.code ?? session?.assignedCentreId ?? '—';
  const district = (session?.centre as { district?: string })?.district ?? '—';

  return (
    <>
      <View style={styles.bottomNav}>
        {/* Dashboard */}
        <Pressable
          style={styles.navItem}
          onPress={() => handleNav('dashboard')}
          hitSlop={8}
        >
          <MaterialIcons
            name="dashboard"
            size={24}
            color={activeTab === 'dashboard' ? Colors.primary : Colors.secondary}
          />
          <Text
            style={[
              Type.labelSm,
              {
                color: activeTab === 'dashboard' ? Colors.primary : Colors.secondary,
                fontWeight: activeTab === 'dashboard' ? '700' : '500',
                marginTop: 2,
              },
            ]}
          >
            Dashboard
          </Text>
        </Pressable>

        {/* Records */}
        <Pressable
          style={styles.navItem}
          onPress={() => handleNav('records')}
          hitSlop={8}
        >
          <MaterialIcons
            name="receipt-long"
            size={24}
            color={activeTab === 'records' ? Colors.primary : Colors.secondary}
          />
          <Text
            style={[
              Type.labelSm,
              {
                color: activeTab === 'records' ? Colors.primary : Colors.secondary,
                fontWeight: activeTab === 'records' ? '700' : '500',
                marginTop: 2,
              },
            ]}
          >
            Records
          </Text>
        </Pressable>

        {/* Scan FAB */}
        <Pressable
          style={styles.scanFab}
          onPress={() => handleNav('scan')}
          hitSlop={6}
        >
          <MaterialIcons name="qr-code-scanner" size={28} color={Colors['on-primary']} />
        </Pressable>

        {/* Roster */}
        <Pressable
          style={styles.navItem}
          onPress={() => handleNav('roster')}
          hitSlop={8}
        >
          <MaterialIcons
            name="badge"
            size={24}
            color={activeTab === 'roster' ? Colors.primary : Colors.secondary}
          />
          <Text
            style={[
              Type.labelSm,
              {
                color: activeTab === 'roster' ? Colors.primary : Colors.secondary,
                fontWeight: activeTab === 'roster' ? '700' : '500',
                marginTop: 2,
              },
            ]}
          >
            Roster
          </Text>
        </Pressable>

        {/* Centre Profile */}
        <Pressable
          style={styles.navItem}
          onPress={() => handleNav('centre')}
          hitSlop={8}
        >
          <MaterialIcons
            name="domain"
            size={24}
            color={activeTab === 'centre' ? Colors.primary : Colors.secondary}
          />
          <Text
            style={[
              Type.labelSm,
              {
                color: activeTab === 'centre' ? Colors.primary : Colors.secondary,
                fontWeight: activeTab === 'centre' ? '700' : '500',
                marginTop: 2,
              },
            ]}
          >
            Centre
          </Text>
        </Pressable>
      </View>

      {/* Centre/Profile Modal */}
      {session ? (
        <Modal
          transparent
          visible={profileVisible}
          animationType="fade"
          onRequestClose={() => setProfileVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setProfileVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHead}>
                <MaterialIcons name="domain" size={20} color={Colors.primary} />
                <Text style={[Type.titleMd, { color: Colors.primary, flex: 1 }]}>
                  Examination Centre Profile
                </Text>
                <Pressable onPress={() => setProfileVisible(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={Colors.secondary} />
                </Pressable>
              </View>

              <View style={styles.modalRow}>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  CENTRE / INSTITUTION
                </Text>
                <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.centre?.name ?? 'Assigned Centre'}</Text>
                <Text style={[Type.labelSm, { color: Colors.primary }]}>
                  Centre Code: {centreCode} ({district})
                </Text>
              </View>

              <View style={styles.modalRow}>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  ACTIVE INVIGILATOR
                </Text>
                <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.name}</Text>
                <Text style={[Type.labelSm, { color: Colors.secondary }]}>
                  {session.verifierId} · {session.role.replace('_', ' ')} · mode: {session.mode}
                </Text>
              </View>

              <View style={styles.modalRow}>
                <Text style={[Type.labelSm, { color: Colors['on-surface-variant'] }]}>
                  ASSIGNED CENTRE ID
                </Text>
                <Text style={[Type.bodyMd, { fontWeight: '600' }]}>{session.assignedCentreId}</Text>
                <Text style={[Type.labelSm, { color: Colors.tertiary }]}>
                  Session stored locally · persists offline
                </Text>
              </View>

              <Pressable style={styles.logoutBtn} onPress={handleAttemptLogout}>
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
      ) : null}

      {/* Unsynced Records Alert Modal */}
      <Modal visible={unsyncedModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setUnsyncedModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHead}>
              <MaterialIcons name="cloud-off" size={24} color={Colors.error} />
              <Text style={[Type.titleMd, { color: Colors.error }]}>
                Unsynced Records Alert
              </Text>
            </View>
            <View style={[styles.modalRow, { backgroundColor: 'rgba(186,26,26,0.06)' }]}>
              <Text style={[Type.bodyMd, { color: Colors['on-surface'] }]}>
                You have{' '}
                <Text style={{ fontWeight: '700', color: Colors.error }}>
                  {pendingUnsynced} attendance record(s)
                </Text>{' '}
                waiting to sync to the central server.
              </Text>
              <Text style={[Type.labelSm, { color: Colors['on-surface-variant'], marginTop: 4 }]}>
                Logging out before syncing may delay candidate verification in the central system.
                Please sync now if internet is available.
              </Text>
            </View>

            <Pressable
              style={styles.syncNowBtn}
              onPress={async () => {
                await runSyncNow();
                const remaining = await getPendingCount();
                setPendingUnsynced(remaining);
                if (remaining === 0) {
                  setUnsyncedModalVisible(false);
                  await signOut();
                  router.replace('/login');
                }
              }}
            >
              <MaterialIcons name="sync" size={18} color="#FFFFFF" />
              <Text style={[Type.titleSm, { color: '#FFFFFF' }]}>
                Sync Now & Logout
              </Text>
            </Pressable>

            <Pressable
              style={styles.logoutAnywayBtn}
              onPress={async () => {
                setUnsyncedModalVisible(false);
                await signOut();
                router.replace('/login');
              }}
            >
              <Text style={[Type.labelMd, { color: Colors.error }]}>
                Logout Anyway (Keep in Queue)
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    backgroundColor: Colors['surface-container-lowest'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors['surface-container'],
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
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
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalRow: {
    backgroundColor: Colors['surface-container-low'],
    borderRadius: Radius.md,
    padding: 12,
    gap: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors['error-container'],
    borderRadius: Radius.full,
    paddingVertical: 12,
    marginTop: 4,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.tertiary,
    borderRadius: Radius.full,
    paddingVertical: 12,
  },
  logoutAnywayBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});
