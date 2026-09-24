import {} from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';

import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

import { ReportMethodLinks } from './ReportMethodLinks';

export function VoiceReportScreen() {
  return (
    <ShellPage title="Report your progress" eyebrow="FIELD · VOICE REPORT">
      <ReportMethodLinks active="voice" />
      <Text style={shellStyles.cardTitle}>
        Voice capture requires the Android app
      </Text>
      <Text style={shellStyles.body}>
        Voice recording is not available on this platform yet.
      </Text>
    </ShellPage>
  );
}
