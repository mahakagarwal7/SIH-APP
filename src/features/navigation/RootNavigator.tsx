import { Stack } from 'expo-router/stack';

import { useAuth } from '@/features/auth/AuthProvider';

export function RootNavigator() {
  const auth = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={auth.status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
