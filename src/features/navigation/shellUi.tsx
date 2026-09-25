import { Link, useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
} from '@/features/localization/LocalizedText';

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
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
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
  compact = false,
}: {
  href: Href;
  label: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        style={
          detail
            ? shellStyles.card
            : compact
              ? shellStyles.compactLink
              : shellStyles.link
        }
      >
        <Text
          style={
            detail
              ? shellStyles.cardTitle
              : compact
                ? shellStyles.compactLinkText
                : shellStyles.linkText
          }
        >
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
    paddingVertical: 22,
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
    color: '#586c7a',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1,
    marginBottom: 12,
  },
  body: { color: '#586c7a', fontSize: 16, lineHeight: 26 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#266b8c',
    borderRadius: 14,
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
  compactLink: {
    minHeight: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  compactLinkText: {
    color: '#266b8c',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 12,
  },
});
