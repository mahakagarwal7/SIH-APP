import { useLocalSearchParams } from 'expo-router';

import { ReportFollowupScreen } from '@/features/claims/ReportFollowupScreen';

export default function FieldReportFollowup() {
  const params = useLocalSearchParams<{ reportId?: string | string[] }>();
  const reportId = Array.isArray(params.reportId)
    ? (params.reportId[0] ?? '')
    : (params.reportId ?? '');
  return <ReportFollowupScreen reportId={reportId} />;
}
