import { Text, View } from 'react-native';

import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';

export default function Projects() {
  return (
    <ShellPage>
      <BackButton />
      <Text accessibilityRole="header" style={shellStyles.heading}>
        Choose a project
      </Text>
      <View style={shellStyles.card}>
        <Text style={shellStyles.cardTitle}>
          Project selection is not available yet
        </Text>
        <Text style={shellStyles.body}>
          My work uses your default active project. Choosing another project
          will be available in a later update.
        </Text>
      </View>
    </ShellPage>
  );
}
