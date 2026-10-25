import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

export type RootStackParamList = {
  index: undefined;
  login: undefined;
  dashboard: undefined;
  scan: undefined;
  records: { filter?: string; status?: string } | undefined;
  'manual-verification': {
    candidateId: string;
    score?: string;
    liveUri?: string;
    reason?: string;
  };
  verified: {
    candidateId: string;
    score?: string;
    via?: string;
  };
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useRouter() {
  const navigation = useNavigation<NavigationProp>();

  return {
    push: (target: string | { pathname: string; params?: any }) => {
      if (typeof target === 'string') {
        const routeName = target.replace(/^\//, '') as keyof RootStackParamList;
        navigation.navigate(routeName as any);
      } else {
        const routeName = target.pathname.replace(/^\//, '') as keyof RootStackParamList;
        navigation.navigate(routeName as any, target.params as any);
      }
    },
    replace: (target: string | { pathname: string; params?: any }) => {
      if (typeof target === 'string') {
        const routeName = target.replace(/^\//, '') as keyof RootStackParamList;
        navigation.reset({
          index: 0,
          routes: [{ name: routeName as any }],
        });
      } else {
        const routeName = target.pathname.replace(/^\//, '') as keyof RootStackParamList;
        navigation.reset({
          index: 0,
          routes: [{ name: routeName as any, params: target.params }],
        });
      }
    },
    back: () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('dashboard');
      }
    },
    canGoBack: () => navigation.canGoBack(),
  };
}

export function useLocalSearchParams<T extends Record<string, any>>(): T {
  const route = useRoute();
  return ((route.params as T) || {}) as T;
}

export { useFocusEffect, useCallback };
