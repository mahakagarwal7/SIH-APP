import {} from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';

import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

export function MyReportsScreen() {
  return (
    <ShellPage title="My reports" eyebrow="FIELD · DELIVERY STATUS">
      <Text style={shellStyles.body}>
        Local outbox synchronization is available in the native Nirmaan app.
      </Text>
    </ShellPage>
  );
}
