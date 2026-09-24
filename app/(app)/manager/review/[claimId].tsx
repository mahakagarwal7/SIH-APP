import { useLocalSearchParams } from 'expo-router';

import { DecisionScreen } from '@/features/claims/DecisionScreen';

export default function ClaimDecision() {
  const params = useLocalSearchParams<{ claimId?: string | string[] }>();
  const claimId = Array.isArray(params.claimId)
    ? (params.claimId[0] ?? '')
    : (params.claimId ?? '');
  return <DecisionScreen claimId={claimId} />;
}
