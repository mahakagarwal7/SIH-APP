import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { LanguageSelector } from '@/features/localization/LanguageSelector';
import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
  LocalizedTextInput as TextInput,
} from '@/features/localization/LocalizedText';

import { useAuth } from './AuthProvider';

import type { AuthViewState } from './AuthProvider';
import type { ComponentRef } from 'react';

export default function AuthScreen() {
  const auth = useAuth();
  return <AuthView auth={auth} />;
}

export function AuthView({ auth }: { auth: AuthViewState }) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.masthead}>
          <Text style={styles.brand}>Nirmaan.</Text>
          <Text style={styles.edition}>MOBILE</Text>
        </View>
        {auth.offline && (
          <Text accessibilityRole="alert" style={styles.banner}>
            Offline · Connect to sign in or refresh your session.
          </Text>
        )}
        <View style={styles.content}>
          {auth.status === 'loading' ? (
            <>
              <Text accessibilityRole="header" style={styles.heading}>
                Welcome back.
              </Text>
              <ActivityIndicator
                accessibilityLabel="Checking saved session"
                color="#17354c"
                style={styles.indicator}
              />
              <Text style={styles.body}>Checking your saved session…</Text>
            </>
          ) : auth.status === 'unconfigured' ? (
            <>
              <Text accessibilityRole="header" style={styles.heading}>
                Sign-in unavailable
              </Text>
              <Text style={styles.body}>
                The app’s connection settings are incomplete. Contact your
                administrator to finish setup.
              </Text>
            </>
          ) : auth.status === 'error' ? (
            <>
              <Text accessibilityRole="header" style={styles.heading}>
                Couldn’t restore your session
              </Text>
              <Text accessibilityRole="alert" style={styles.error}>
                {auth.message}
              </Text>
              <Action
                label="Try again"
                disabled={auth.offline}
                onPress={() => {
                  void auth.retry();
                }}
              />
            </>
          ) : auth.status === 'signedIn' ? (
            <AuthAccount auth={auth} />
          ) : (
            <>
              <Text style={styles.eyebrow}>FROM THE FIELD TO THE PLAN</Text>
              <Text accessibilityRole="header" style={styles.heading}>
                Sign in to Nirmaan
              </Text>
              <Text style={styles.body}>
                Use the account provided by your project team.
              </Text>
              <SignInForm auth={auth} />
            </>
          )}
          {!auth.persistent && auth.status !== 'signedIn' && (
            <Text style={styles.preview}>
              Browser preview: sign-in is cleared when you reload or close this
              page.
            </Text>
          )}
          {auth.status !== 'loading' && <LanguageSelector />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthAccount({ auth }: { auth: AuthViewState }) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.heading}>
        Your account
      </Text>
      <View style={styles.record}>
        <Text style={styles.label}>SIGNED IN AS</Text>
        <Text selectable style={styles.account}>
          {auth.session?.user.email ?? 'Email not recorded'}
        </Text>
      </View>
      {auth.message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {auth.message}
        </Text>
      )}
      <Action
        label={auth.busy ? 'Signing out…' : 'Sign out'}
        disabled={auth.busy}
        onPress={() => {
          void auth.signOut();
        }}
      />
      {!auth.persistent && (
        <Text style={styles.preview}>
          Browser preview: sign-in is cleared when you reload or close this
          page.
        </Text>
      )}
    </>
  );
}

function SignInForm({ auth }: { auth: AuthViewState }) {
  // Form state disappears when another auth state unmounts this component.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    if (auth.busy || auth.offline) return;
    try {
      await auth.signIn(email, password);
    } finally {
      setPassword('');
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        accessibilityLabel="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        maxLength={254}
        editable={!auth.busy}
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        ref={passwordInput}
        accessibilityLabel="Password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        editable={!auth.busy}
        maxLength={256}
        onSubmitEditing={() => {
          void submit();
        }}
      />
      {auth.message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {auth.message}
        </Text>
      )}
      <Action
        label={auth.busy ? 'Signing in…' : 'Sign in'}
        disabled={auth.busy || auth.offline}
        onPress={() => {
          void submit();
        }}
      />
    </View>
  );
}

function Action({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (disabled || pressed) && styles.dimmed,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const serif = Platform.select({
  android: 'serif',
  ios: 'Georgia',
  default: 'Georgia, "Times New Roman", serif',
});
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f5' },
  scroll: { flexGrow: 1 },
  masthead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d7e0e5',
  },
  brand: {
    color: '#17354c',
    fontFamily: serif,
    fontSize: 30,
    fontWeight: '700',
  },
  edition: {
    color: '#627786',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  banner: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    padding: 24,
    paddingVertical: 36,
  },
  eyebrow: {
    color: '#586c7a',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1,
    marginBottom: 14,
  },
  heading: {
    color: '#17354c',
    fontFamily: serif,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 42,
    marginBottom: 12,
  },
  body: { color: '#586c7a', fontSize: 16, lineHeight: 26 },
  form: { marginTop: 28 },
  label: {
    color: '#17354c',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    color: '#17354c',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a9bac6',
    borderRadius: 3,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    marginBottom: 20,
  },
  button: {
    minHeight: 52,
    padding: 14,
    backgroundColor: '#17354c',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  dimmed: { opacity: 0.6 },
  error: { color: '#873725', fontSize: 15, lineHeight: 24, marginVertical: 12 },
  record: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    borderLeftWidth: 3,
    borderLeftColor: '#266b8c',
    padding: 20,
    marginVertical: 12,
  },
  account: { color: '#17354c', fontSize: 17, lineHeight: 27 },
  indicator: { alignSelf: 'flex-start', marginVertical: 16 },
  preview: { color: '#586c7a', fontSize: 13, lineHeight: 21, marginTop: 28 },
});
