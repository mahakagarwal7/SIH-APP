import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { AuthAccount } from '@/features/auth/AuthScreen';
import { LanguageSelector } from '@/features/localization/LanguageSelector';
import { LocalizedText as Text } from '@/features/localization/LocalizedText';
import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';

export default function Account() {
  const auth = useAuth();
  const router = useRouter();
  return (
    <ShellPage>
      <BackButton />
      <AuthAccount auth={auth} />
      <LanguageSelector />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.dismissAll();
          router.replace('/workspaces');
        }}
        style={[shellStyles.link, { marginTop: 24 }]}
      >
        <Text style={shellStyles.linkText}>Switch workspace</Text>
      </Pressable>
      <Text style={[shellStyles.body, { marginTop: 24, fontSize: 13 }]}>
        Nirmaan{' '}
        {Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.1.0'}
        {Constants.nativeBuildVersion
          ? ` · Build ${Constants.nativeBuildVersion}`
          : ''}
      </Text>
      <Text style={[shellStyles.body, { fontSize: 13 }]}>
        {Constants.expoConfig?.extra?.sourceCommit
          ? `Source ${String(Constants.expoConfig.extra.sourceCommit).slice(0, 8)}`
          : 'Local development build'}
      </Text>
    </ShellPage>
  );
}
