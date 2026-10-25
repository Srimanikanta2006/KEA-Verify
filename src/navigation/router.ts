import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

export type RootStackParamList = {
  index: undefined;
  login: undefined;
  dashboard: undefined;
  scan: undefined;
  records: { filter?: string; status?: string; tab?: string } | undefined;
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

function parseTarget(target: string | { pathname: string; params?: any }): {
  routeName: keyof RootStackParamList;
  params?: any;
} {
  if (typeof target === 'string') {
    const clean = target.replace(/^\//, '');
    const qIndex = clean.indexOf('?');
    if (qIndex !== -1) {
      const path = clean.substring(0, qIndex) as keyof RootStackParamList;
      const q = clean.substring(qIndex + 1);
      const params: Record<string, string> = {};
      q.split('&').forEach((part) => {
        const [k, v] = part.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
      return { routeName: path, params };
    }
    return { routeName: clean as keyof RootStackParamList };
  }
  return {
    routeName: target.pathname.replace(/^\//, '') as keyof RootStackParamList,
    params: target.params,
  };
}


export function useRouter() {
  const navigation = useNavigation<NavigationProp>();

  return useMemo(
    () => ({
      push: (target: string | { pathname: string; params?: any }) => {
        const { routeName, params } = parseTarget(target);
        navigation.navigate(routeName as any, params);
      },
      replace: (target: string | { pathname: string; params?: any }) => {
        const { routeName, params } = parseTarget(target);
        if ('replace' in navigation && typeof (navigation as any).replace === 'function') {
          (navigation as any).replace(routeName, params);
        } else {
          navigation.navigate(routeName as any, params);
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
    }),
    [navigation]
  );
}

export function useLocalSearchParams<T extends Record<string, any>>(): T {
  const route = useRoute();
  return ((route.params as T) || {}) as T;
}

export { useFocusEffect, useCallback };
