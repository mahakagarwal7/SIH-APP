import { Text, View } from 'react-native';

import { ShellPage, shellStyles } from './shellUi';

export function PlaceholderScreen({
  title,
  workspace,
  description,
}: {
  title: string;
  workspace: 'Field' | 'Manager';
  description: string;
}) {
  return (
    <ShellPage title={title} eyebrow={`${workspace.toUpperCase()} WORKSPACE`}>
      <Text style={shellStyles.body}>{description}</Text>
      <View style={shellStyles.card}>
        <Text style={shellStyles.cardTitle}>Not available yet</Text>
        <Text style={shellStyles.body}>
          This part of Nirmaan is not ready to use. No project records are shown
          here yet.
        </Text>
      </View>
    </ShellPage>
  );
}
