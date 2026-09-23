import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Href } from 'expo-router';

export function ReportMethodLinks({
  active,
}: {
  active: 'voice' | 'text' | 'photo';
}) {
  const methods = [
    { key: 'voice' as const, label: 'Voice', href: '/field/report' as Href },
    { key: 'text' as const, label: 'Type', href: '/field/report/text' as Href },
    {
      key: 'photo' as const,
      label: 'Photo',
      href: '/field/report/photo' as Href,
    },
  ];
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {methods.map((method) => (
        <Link key={method.key} href={method.href} asChild>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active === method.key }}
            style={[styles.tab, active === method.key && styles.active]}
          >
            <Text
              style={[
                styles.label,
                active === method.key && styles.activeLabel,
              ]}
            >
              {method.label}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: {
    minHeight: 48,
    minWidth: 84,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
  },
  active: { backgroundColor: '#17354c', borderColor: '#17354c' },
  label: { color: '#266b8c', fontSize: 15, fontWeight: '600' },
  activeLabel: { color: '#fff' },
});
