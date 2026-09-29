import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Type } from '@/constants/theme';
import { runSyncNow, useSyncStatus } from '@/services/syncManager';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Feature 6 UI: surfaces the offline queue state (spec: "Offline Cache Ready").
 * Compact single-line banner; tapping it forces a sync attempt when online.
 */
export function SyncBanner({ forceShow = false }: { forceShow?: boolean }) {
  const { online, pending, syncing, lastError } = useSyncStatus();

  if (!forceShow && online && pending === 0 && !lastError) return null;

  let icon: IconName = 'cloud-done';
  let bg: string = Colors['tertiary-fixed'];
  let fg: string = Colors['on-tertiary-fixed'];
  let text = 'All scans synced';

  if (!online) {
    icon = 'cloud-off';
    bg = Colors['primary-fixed'];
    fg = Colors['on-primary-fixed-variant'];
    text =
      pending > 0
        ? `Offline — ${pending} scan${pending === 1 ? '' : 's'} cached on device, will auto-sync`
        : 'Offline Cache Ready — scanning works without wifi';
  } else if (syncing) {
    icon = 'sync';
    bg = Colors['secondary-container'];
    fg = Colors['on-secondary-container'];
    text = `Syncing ${pending} queued scan${pending === 1 ? '' : 's'}…`;
  } else if (pending > 0) {
    icon = 'cloud-upload';
    bg = Colors['secondary-container'];
    fg = Colors['on-secondary-container'];
    text = `${pending} scan${pending === 1 ? '' : 's'} queued — syncing automatically`;
  } else if (lastError) {
    icon = 'error';
    bg = Colors['error-container'];
    fg = Colors['on-error-container'];
    text = lastError;
  }

  return (
    <Pressable style={[styles.banner, { backgroundColor: bg }]} onPress={() => void runSyncNow()}>
      <MaterialIcons name={icon} size={14} color={fg} />
      <Text style={[Type.labelSm, { color: fg, flex: 1 }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'stretch',
  },
});
