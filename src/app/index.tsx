import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/navigation/router';

export default function Entry() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'signed_in') {
      router.replace('/dashboard');
    } else if (status === 'signed_out') {
      router.replace('/login');
    }
  }, [status, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9ff' }}>
      <ActivityIndicator size="large" color="#d97b29" />
    </View>
  );
}
