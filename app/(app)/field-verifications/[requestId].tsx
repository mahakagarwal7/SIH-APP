import { useLocalSearchParams } from 'expo-router';

import { VerificationScreen } from '@/features/claims/VerificationScreens';

export default function FieldVerification() {
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = Array.isArray(params.requestId)
    ? (params.requestId[0] ?? '')
    : (params.requestId ?? '');
  return <VerificationScreen requestId={requestId} />;
}
