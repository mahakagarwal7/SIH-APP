import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';
import { useLocalization } from '@/features/localization/LocalizationProvider';

import type { ComponentProps } from 'react';

type Tab = {
  name: string;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  hidden?: boolean;
};
const tabs: Record<'field' | 'manager', Tab[]> = {
  field: [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'report', label: 'Report', icon: 'mic' },
    { name: 'work', label: 'My work', icon: 'clipboard' },
    { name: 'reports', label: 'My reports', icon: 'file-text' },
  ],
  manager: [
    { name: 'index', label: 'Overview', icon: 'grid' },
    { name: 'review', label: 'Review', icon: 'check-square' },
    { name: 'schedule', label: 'Schedule', icon: 'calendar' },
    { name: 'history', label: 'History', icon: 'clock' },
    {
      name: 'review/[claimId]',
      label: 'Review detail',
      icon: 'check-square',
      hidden: true,
    },
  ],
};

export function WorkspaceTabs({ workspace }: { workspace: keyof typeof tabs }) {
  const { fontScale } = useWindowDimensions();
  const { t } = useLocalization();
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#17354c',
        tabBarInactiveTintColor: '#627786',
        tabBarActiveBackgroundColor: '#e8eff3',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#d7e0e5',
          height: 56 + 24 * Math.max(1, fontScale),
          paddingVertical: 6,
        },
        tabBarLabelPosition: 'below-icon',
      }}
    >
      {tabs[workspace].map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            href: tab.hidden ? null : undefined,
            title: t(tab.label),
            tabBarAccessibilityLabel: t(tab.label),
            tabBarLabel: ({ color }) => (
              <Text
                style={{
                  color,
                  fontSize: 12,
                  textAlign: 'center',
                  paddingHorizontal: 2,
                }}
              >
                {tab.label}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => (
              <Feather name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
