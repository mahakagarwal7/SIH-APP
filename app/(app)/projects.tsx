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
          Your project list has not been loaded. This does not mean you have no
          project access.
        </Text>
      </View>
    </ShellPage>
  );
}
