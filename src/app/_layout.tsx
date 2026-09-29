import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { startSyncManager } from '@/services/syncManager';

startSyncManager();

SplashScreen.preventAutoHideAsync();

function RouteGate() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="manual-verification" />
      <Stack.Screen name="verified" />
      <Stack.Screen name="records" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RouteGate />
    </AuthProvider>
  );
}
