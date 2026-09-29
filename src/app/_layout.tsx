import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { startSyncManager } from '@/services/syncManager';

startSyncManager();

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const fontId = 'material-icons-font-link';
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'material-icons-web-style';
    style.textContent = `
      @font-face {
        font-family: 'material';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialIcons';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
      @font-face {
        font-family: 'Material Icons';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
    `;
    document.head.appendChild(style);
  }
}

function RouteGate() {
  const { status } = useAuth();
  const [fontsLoaded] = useFonts(
    Platform.OS === 'web'
      ? {}
      : {
          material: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
          MaterialIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        }
  );

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
