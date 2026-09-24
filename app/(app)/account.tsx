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
    </ShellPage>
  );
}
