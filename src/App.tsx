import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import type { RootStackParamList } from './navigation/router';

// Screen imports
import IndexScreen from './app/index';
import LoginScreen from './app/login';
import DashboardScreen from './app/dashboard';
import ScanScreen from './app/scan';
import RecordsScreen from './app/records';
import ManualVerificationScreen from './app/manual-verification';
import VerifiedScreen from './app/verified';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" component={IndexScreen} />
            <Stack.Screen name="login" component={LoginScreen} />
            <Stack.Screen name="dashboard" component={DashboardScreen} />
            <Stack.Screen name="scan" component={ScanScreen} />
            <Stack.Screen name="records" component={RecordsScreen} />
            <Stack.Screen name="manual-verification" component={ManualVerificationScreen} />
            <Stack.Screen name="verified" component={VerifiedScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
