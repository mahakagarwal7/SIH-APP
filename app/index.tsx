import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { AuthView } from '@/features/auth/AuthScreen';

export default function Entry() {
  const auth = useAuth();
  return auth.status === 'signedIn' ? (
    <Redirect href="/workspaces" />
  ) : (
    <AuthView auth={auth} />
  );
}
