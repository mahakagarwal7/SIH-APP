import Feather from '@expo/vector-icons/Feather';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';
import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

import { fieldHomeSummary, groupMyWork, siteToday } from './myWork';
import { useMyWork } from './useMyWork';

import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

type ActionTileProps = {
  href: Href;
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  backgroundColor: string;
  accentColor: string;
};

function ActionTile({
  href,
  icon,
  label,
  backgroundColor,
  accentColor,
}: ActionTileProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        style={[
          styles.actionTile,
          { backgroundColor, borderColor: accentColor },
        ]}
      >
        <View style={[styles.actionIcon, { backgroundColor: accentColor }]}>
          <Feather color="#ffffff" name={icon} size={24} />
        </View>
        <Text style={[styles.actionLabel, { color: accentColor }]}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function HomeHeader({ displayName }: { displayName: string }) {
  const initial = displayName.trim().charAt(0).toLocaleUpperCase() || 'N';
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.wordmark}>
          Nirmaan
        </Text>
      </View>
      <Link href="/account" asChild>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          style={styles.settings}
        >
          <Feather color="#17354c" name="settings" size={21} />
        </Pressable>
      </Link>
    </View>
  );
}

export function FieldHomeScreen() {
  const [today, setToday] = useState(siteToday);
  const { project, work, refresh, offline } = useMyWork();
  useEffect(() => {
    const timer = setInterval(() => setToday(siteToday()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useFocusEffect(
    useCallback(() => {
      setToday(siteToday());
      void refresh();
    }, [refresh]),
  );

  const context = project.data;
  const activities = work.data?.snapshot.revisionId
    ? work.data.snapshot.activities
    : [];
  const groups =
    context && work.data && !work.error
      ? groupMyWork(
          activities,
          work.data.assignments,
          context.member.user_id,
          today,
        )
      : null;
  const current = groups?.find((group) => group.title === 'Today')?.items ?? [];
  const assignedActivities =
    groups?.flatMap((group) => group.items.map((item) => item.activity)) ?? [];
  const summary = fieldHomeSummary(assignedActivities, today);
  const primary = current[0]?.activity;
  const location =
    primary?.location ?? assignedActivities[0]?.location ?? 'Site not recorded';
  const assignment = primary
    ? current.length === 1
      ? primary.name
      : `${current.length} assignments today`
    : 'No assignment today.';
  const timingStyle =
    summary.timing === 'DELAYED'
      ? styles.delayed
      : summary.timing === 'ON TIME'
        ? styles.onTime
        : styles.timingUnknown;

  return (
    <ShellPage>
      <HomeHeader displayName={context?.member.display_name ?? 'Nirmaan'} />
      {offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Showing project context already saved on this device. Server
          data may have changed.
        </Text>
      )}
      {project.error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Project unavailable
          </Text>
          <Text style={shellStyles.body}>{project.error.message}</Text>
        </View>
      ) : project.isPending ? (
        <View style={styles.state}>
          {!offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>Loading your project…</Text>
        </View>
      ) : !context ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Ask a project manager to check your membership.
          </Text>
        </View>
      ) : work.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {work.error.message}
        </Text>
      ) : !work.data ? (
        <View style={styles.state}>
          {!offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {offline
              ? 'Connect to load assignments for this project.'
              : 'Loading assignments…'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View
              style={[
                styles.progressCircle,
                summary.percent === 100 && styles.progressComplete,
              ]}
            >
              <Text style={styles.percent}>
                {summary.percent === null ? '—' : `${summary.percent}%`}
              </Text>
              <Text style={styles.doneLabel}>ACCEPTED PROGRESS</Text>
            </View>
            <View style={styles.summaryCopy}>
              <Text numberOfLines={1} style={styles.projectLabel}>
                {context.project.name}
              </Text>
              <Text numberOfLines={2} style={styles.location}>
                {work.data.snapshot.revisionId === null
                  ? 'No active schedule'
                  : location}
              </Text>
              <Text numberOfLines={2} style={styles.assignment}>
                {assignment}
              </Text>
              <View style={[styles.timingPill, timingStyle]}>
                <Text style={[styles.timingText, timingStyle]}>
                  {summary.timing}
                </Text>
              </View>
              <Link href="/projects" asChild>
                <Pressable
                  accessibilityLabel="Change project"
                  accessibilityRole="button"
                  style={styles.changeProject}
                >
                  <Text style={styles.changeProjectText}>Change project</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <ActionTile
              accentColor="#24a865"
              backgroundColor="#e9f8ef"
              href="/field/report"
              icon="mic"
              label="Speak Report"
            />
            <ActionTile
              accentColor="#3478d4"
              backgroundColor="#eaf2ff"
              href="/field/report/photo"
              icon="camera"
              label="Take Photo"
            />
            <ActionTile
              accentColor="#df9216"
              backgroundColor="#fff5df"
              href="/field/work"
              icon="clipboard"
              label="My Tasks"
            />
            <ActionTile
              accentColor="#7655d9"
              backgroundColor="#f1edff"
              href="/field/work"
              icon="trending-up"
              label="View Progress"
            />
          </View>
        </>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8eff3',
  },
  avatarText: { color: '#17354c', fontSize: 17, fontWeight: '800' },
  wordmark: { color: '#17354c', fontSize: 23, fontWeight: '800' },
  settings: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8ec',
  },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 21,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  error: {
    color: '#8a2e25',
    backgroundColor: '#fff0ed',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  summaryCard: {
    minHeight: 174,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4e9ec',
    shadowColor: '#17354c',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  progressCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 9,
    borderColor: '#dfe7e3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fffa',
  },
  progressComplete: { borderColor: '#2fc96f' },
  percent: {
    color: '#17354c',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  doneLabel: {
    color: '#24a865',
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  projectLabel: {
    color: '#73818b',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  location: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  assignment: { color: '#627786', fontSize: 13, lineHeight: 19, marginTop: 2 },
  timingPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 9,
  },
  timingText: { fontSize: 10, lineHeight: 14, fontWeight: '800' },
  onTime: { color: '#1f9c57', backgroundColor: '#ddf7e7' },
  delayed: { color: '#b63c32', backgroundColor: '#fde7e4' },
  timingUnknown: { color: '#9a6815', backgroundColor: '#fff1cf' },
  changeProject: { minHeight: 36, justifyContent: 'center', marginTop: 3 },
  changeProjectText: { color: '#266b8c', fontSize: 12, fontWeight: '700' },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  actionTile: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 132,
    minHeight: 126,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 14,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
