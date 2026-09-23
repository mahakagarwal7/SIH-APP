import { Link, useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Href } from 'expo-router';
import type { ReactNode } from 'react';

export function ShellPage({
  title,
  eyebrow,
  children,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={shellStyles.screen}
      contentContainerStyle={shellStyles.scroll}
    >
      <View style={shellStyles.content}>
        {eyebrow && <Text style={shellStyles.eyebrow}>{eyebrow}</Text>}
        {title && (
          <Text accessibilityRole="header" style={shellStyles.heading}>
            {title}
          </Text>
        )}
        {children}
      </View>
    </ScrollView>
  );
}

export function NavLink({
  href,
  label,
  detail,
}: {
  href: Href;
  label: string;
  detail?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={detail ? shellStyles.card : shellStyles.link}>
        <Text style={detail ? shellStyles.cardTitle : shellStyles.linkText}>
          {label}
        </Text>
        {detail && <Text style={shellStyles.body}>{detail}</Text>}
      </Pressable>
    </Link>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace('/workspaces')
      }
      style={shellStyles.back}
    >
      <Text style={shellStyles.linkText}>Back</Text>
    </Pressable>
  );
}

export const shellStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f4f5' },
  scroll: { flexGrow: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    padding: 24,
    paddingVertical: 30,
  },
  heading: {
    color: '#17354c',
    fontFamily: Platform.select({
      android: 'serif',
      ios: 'Georgia',
      default: 'Georgia, "Times New Roman", serif',
    }),
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '700',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#627786',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1,
    marginBottom: 12,
  },
  body: { color: '#627786', fontSize: 16, lineHeight: 26 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#266b8c',
    padding: 20,
    marginTop: 20,
    gap: 8,
  },
  cardTitle: {
    color: '#17354c',
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '600',
  },
  link: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  linkText: {
    color: '#266b8c',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 12,
  },
});
