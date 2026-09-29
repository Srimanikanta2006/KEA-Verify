import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function Entry() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signed_in') return <Redirect href="/dashboard" />;
  return <Redirect href="/login" />;
}
