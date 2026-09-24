import {} from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';
import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

export function ConfirmationScreen() {
  return (
    <ShellPage title="Check your report" eyebrow="FIELD · CHECK · SEND">
      <Text style={shellStyles.body}>
        Report confirmation is available in the native Nirmaan app.
      </Text>
    </ShellPage>
  );
}
