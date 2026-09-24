import { Stack } from 'expo-router/stack';
import { View } from 'react-native';

import { ShellHeader } from '@/features/navigation/ShellHeader';
import { shellStyles } from '@/features/navigation/shellUi';

export const unstable_settings = { initialRouteName: 'workspaces' };

export default function AppLayout() {
  return (
    <View style={shellStyles.screen}>
      <ShellHeader />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="workspaces" />
        <Stack.Screen name="field" />
        <Stack.Screen name="field-confirm/[captureId]" />
        <Stack.Screen name="field-report" />
        <Stack.Screen name="field-verifications" />
        <Stack.Screen name="manager" />
        <Stack.Screen name="account" />
        <Stack.Screen name="projects" />
      </Stack>
    </View>
  );
}
