import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ToastProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LocalizationProvider } from '@/features/localization/LocalizationProvider';
import { RootNavigator } from '@/features/navigation/RootNavigator';
import { ServerStateProvider } from '@/lib/queryClient';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <LocalizationProvider>
          <AuthProvider>
            <ToastProvider>
              <ServerStateProvider>
                <RootNavigator />
              </ServerStateProvider>
            </ToastProvider>
          </AuthProvider>
        </LocalizationProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
});
