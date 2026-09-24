import {} from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';

import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

export function TextPhotoReportScreen({ mode }: { mode: 'text' | 'photo' }) {
  return (
    <ShellPage title="Report progress" eyebrow="FIELD · TEXT AND PHOTO">
      <Text style={shellStyles.cardTitle}>
        {mode === 'photo' ? 'Photo capture' : 'Local report drafts'} require the
        mobile app
      </Text>
      <Text style={shellStyles.body}>
        Open Nirmaan on Android or iOS to save text and photos privately on the
        device.
      </Text>
    </ShellPage>
  );
}
