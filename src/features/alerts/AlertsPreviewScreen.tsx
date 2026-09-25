import Feather from '@expo/vector-icons/Feather';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/features/localization/LocalizationProvider';
import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';

import type { ComponentProps } from 'react';

type AlertFilter = 'all' | 'critical' | 'pending';
type PreviewAlert = {
  id: string;
  state: 'critical' | 'approved' | 'pending';
  title: string;
  description: string;
  timestamp: string;
};

const previewAlerts: PreviewAlert[] = [
  {
    id: 'critical-delay-example',
    state: 'critical',
    title: 'Critical delay example',
    description:
      'Demo: Sector B excavation is delayed by two days due to a rock hurdle.',
    timestamp: 'EXAMPLE · 10 MINS AGO',
  },
  {
    id: 'approved-inspection-example',
    state: 'approved',
    title: 'Approved inspection example',
    description:
      'Demo: Foundation inspection was approved by the chief planner.',
    timestamp: 'EXAMPLE · 10 MINS AGO',
  },
  {
    id: 'pending-approval-example',
    state: 'pending',
    title: 'Pending approval example',
    description: 'Demo: A reinforcement update is waiting for planner review.',
    timestamp: 'EXAMPLE · 20 MINS AGO',
  },
];

const tones = {
  critical: {
    accent: '#ef5d5d',
    background: '#fff1f1',
    icon: 'alert-triangle' as const,
  },
  approved: {
    accent: '#2dbd70',
    background: '#edfff4',
    icon: 'check-circle' as const,
  },
  pending: {
    accent: '#e9a11b',
    background: '#fff8e8',
    icon: 'clock' as const,
  },
};

function FilterButton({
  filter,
  label,
  count,
  selected,
  onPress,
}: {
  filter: AlertFilter;
  label: string;
  count?: number;
  selected: boolean;
  onPress(filter: AlertFilter): void;
}) {
  return (
    <Pressable
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(filter)}
      style={[styles.filter, selected && styles.filterSelected]}
    >
      <Text
        style={[styles.filterLabel, selected && styles.filterLabelSelected]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.count, selected && styles.countSelected]}>
          <Text
            style={[styles.countText, selected && styles.countTextSelected]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function AlertCard({
  alert,
  onOpen,
}: {
  alert: PreviewAlert;
  onOpen(alert: PreviewAlert): void;
}) {
  const tone = tones[alert.state];
  return (
    <View
      accessibilityLabel={`${alert.title}. ${alert.description}`}
      style={[
        styles.card,
        { backgroundColor: tone.background, borderColor: tone.accent },
      ]}
    >
      <View style={styles.cardHeading}>
        <View style={[styles.alertIcon, { borderColor: tone.accent }]}>
          <Feather color={tone.accent} name={tone.icon} size={18} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.timestamp, { color: tone.accent }]}>
            {alert.timestamp}
          </Text>
          <Text style={styles.cardTitle}>{alert.title}</Text>
          <Text numberOfLines={2} style={styles.description}>
            {alert.description}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={`View details for ${alert.title}`}
        accessibilityRole="button"
        onPress={() => onOpen(alert)}
        style={[styles.detailButton, { borderColor: tone.accent }]}
      >
        <Text style={[styles.detailButtonText, { color: tone.accent }]}>
          VIEW DETAILS
        </Text>
      </Pressable>
    </View>
  );
}

const previewTabs: {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
}[] = [
  { label: 'Home', icon: 'home' },
  { label: 'Report', icon: 'mic' },
  { label: 'Tasks', icon: 'clipboard' },
  { label: 'Alerts', icon: 'bell' },
  { label: 'Profile', icon: 'user' },
];

function ReferenceTabBar() {
  return (
    <View
      accessibilityLabel="Reference navigation preview. Alerts selected."
      style={styles.tabBar}
    >
      {previewTabs.map((tab) => {
        const selected = tab.label === 'Alerts';
        return (
          <View key={tab.label} style={styles.tab}>
            <Feather
              color={selected ? '#7655d9' : '#8b98a1'}
              name={tab.icon}
              size={19}
            />
            <Text
              style={[styles.tabLabel, selected && styles.tabLabelSelected]}
            >
              {tab.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function AlertsPreviewScreen() {
  useLocalization();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [previewMessage, setPreviewMessage] = useState('');
  const criticalCount = previewAlerts.filter(
    (alert) => alert.state === 'critical',
  ).length;
  const pendingCount = previewAlerts.filter(
    (alert) => alert.state === 'pending',
  ).length;
  const visible = previewAlerts.filter(
    (alert) => filter === 'all' || alert.state === filter,
  );

  function selectFilter(next: AlertFilter) {
    setFilter(next);
    setPreviewMessage('');
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        style={styles.scrollView}
        testID="alerts-preview-scroll"
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.heading}>
            Alerts & Approvals
          </Text>
          <Link href="/account" asChild>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              style={styles.settings}
            >
              <Feather color="#17354c" name="settings" size={20} />
            </Pressable>
          </Link>
        </View>

        <Text accessibilityRole="alert" style={styles.previewNotice}>
          DESIGN PREVIEW · No live alerts or approvals are connected.
        </Text>

        <View accessibilityRole="tablist" style={styles.filters}>
          <FilterButton
            filter="all"
            label="All"
            onPress={selectFilter}
            selected={filter === 'all'}
          />
          <FilterButton
            count={criticalCount}
            filter="critical"
            label="Critical"
            onPress={selectFilter}
            selected={filter === 'critical'}
          />
          <FilterButton
            count={pendingCount}
            filter="pending"
            label="Pending"
            onPress={selectFilter}
            selected={filter === 'pending'}
          />
        </View>

        {!!previewMessage && (
          <Text accessibilityRole="alert" style={styles.previewMessage}>
            {previewMessage}
          </Text>
        )}

        <View style={styles.cards}>
          {visible.map((alert) => (
            <AlertCard
              alert={alert}
              key={alert.id}
              onOpen={(selected) =>
                setPreviewMessage(
                  `Preview only · ${selected.title} has no live record.`,
                )
              }
            />
          ))}
        </View>
      </ScrollView>
      <ReferenceTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f7' },
  scrollView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    color: '#17283a',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
  },
  settings: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e7eb',
  },
  previewNotice: {
    color: '#6a548d',
    backgroundColor: '#f1edff',
    borderRadius: 12,
    padding: 12,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 6,
  },
  filter: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e6e9',
  },
  filterSelected: { backgroundColor: '#7655d9', borderColor: '#7655d9' },
  filterLabel: { color: '#53636e', fontSize: 11, fontWeight: '800' },
  filterLabelSelected: { color: '#ffffff' },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efeafe',
  },
  countSelected: { backgroundColor: '#ffffff' },
  countText: {
    color: '#7655d9',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  countTextSelected: { color: '#7655d9' },
  previewMessage: {
    color: '#6a548d',
    backgroundColor: '#f1edff',
    borderRadius: 10,
    padding: 11,
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
  },
  cards: { gap: 12, marginTop: 10 },
  card: {
    borderRadius: 15,
    borderWidth: 1.5,
    borderLeftWidth: 4,
    padding: 14,
    gap: 12,
    shadowColor: '#17354c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeading: { flexDirection: 'row', gap: 10 },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
  },
  cardCopy: { flex: 1, minWidth: 0 },
  timestamp: { fontSize: 9, lineHeight: 13, fontWeight: '900' },
  cardTitle: {
    color: '#314552',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 1,
  },
  description: { color: '#5e6f7a', fontSize: 12, lineHeight: 18, marginTop: 2 },
  detailButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  detailButtonText: { fontSize: 10, lineHeight: 14, fontWeight: '900' },
  tabBar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e7ea',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { color: '#8b98a1', fontSize: 9, lineHeight: 12 },
  tabLabelSelected: { color: '#7655d9', fontWeight: '800' },
});
