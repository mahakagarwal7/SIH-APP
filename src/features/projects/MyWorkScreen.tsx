import Feather from '@expo/vector-icons/Feather';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  getActiveLocaleTag,
  useLocalization,
} from '@/features/localization/LocalizationProvider';
import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';
import { NavLink, shellStyles } from '@/features/navigation/shellUi';

import {
  groupMyWork,
  presentWorkActivity,
  shiftSiteDate,
  siteToday,
} from './myWork';
import { useMyWork } from './useMyWork';

import type { WorkActivity, WorkItem, WorkPresentation } from './myWork';
import type { Href } from 'expo-router';

const statusTheme: Record<
  WorkPresentation['status'],
  { accent: string; pale: string; icon: 'check' | 'tool' | 'play' | 'x' }
> = {
  DONE: { accent: '#25b965', pale: '#e2f8eb', icon: 'check' },
  WORKING: { accent: '#3478d4', pale: '#e6f0ff', icon: 'tool' },
  START: { accent: '#3d83e8', pale: '#e8f1ff', icon: 'play' },
  DELAYED: { accent: '#ef4f4f', pale: '#fde8e8', icon: 'x' },
};

function taskDateLabel(date: string, today: string, todayCopy: string) {
  const value = new Date(`${date}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat(getActiveLocaleTag(), {
    ...(date === today ? {} : { weekday: 'short' as const }),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const formatted = formatter.format(value).toLocaleUpperCase();
  return date === today ? `${todayCopy}, ${formatted}` : formatted;
}

// Preserve the supplied number's significant digits instead of rounding to three decimals.
function quantityLabel(activity: WorkActivity) {
  const formatter = new Intl.NumberFormat(getActiveLocaleTag(), {
    maximumSignificantDigits: 21,
  });
  const accepted = formatter.format(activity.acceptedQuantity);
  const unit = activity.unit ? ` ${activity.unit}` : ' (unit not recorded)';
  if (activity.targetQuantity === null)
    return `${accepted}${unit} accepted · Planned quantity not recorded`;
  return `${accepted} of ${formatter.format(activity.targetQuantity)}${unit} accepted`;
}

function WorkCard({ item, today }: { item: WorkItem; today: string }) {
  const { t } = useLocalization();
  const activity = item.activity;
  const presentation = presentWorkActivity(activity, today);
  const progressLabel =
    presentation.percent === null
      ? t('Progress not recorded')
      : `${presentation.percent}%`;
  const theme = statusTheme[presentation.status];
  return (
    <Link href={`/task-hierarchy/${activity.id}` as Href} asChild>
      <Pressable
        accessibilityLabel={`${activity.name}. ${t(presentation.status)}. ${progressLabel}. ${t('Open task hierarchy')}`}
        accessibilityRole="button"
        style={StyleSheet.flatten([
          styles.taskCard,
          { borderLeftColor: theme.accent },
        ])}
      >
        <View style={[styles.statusIcon, { backgroundColor: theme.pale }]}>
          <Feather color={theme.accent} name={theme.icon} size={18} />
        </View>
        <View style={styles.taskBody}>
          <Text numberOfLines={2} style={styles.taskName}>
            {activity.name}
          </Text>
          <Text numberOfLines={1} style={styles.taskMeta}>
            {activity.externalId} · {activity.location}
          </Text>
          <View style={styles.progressRow}>
            <View
              accessibilityLabel="Accepted progress"
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: presentation.percent ?? undefined,
                text: progressLabel,
              }}
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${presentation.percent ?? 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressPercent, { color: theme.accent }]}>
              {presentation.percent === null ? '—' : `${presentation.percent}%`}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.quantity}>
            {quantityLabel(activity)}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: theme.pale }]}>
          <Text style={[styles.statusText, { color: theme.accent }]}>
            {presentation.status}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function TaskHeader({ displayName }: { displayName: string }) {
  const initial = displayName.trim().charAt(0).toLocaleUpperCase() || 'N';
  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          My Tasks
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

export function MyWorkScreen() {
  const { t } = useLocalization();
  const { project, work, refresh, offline } = useMyWork();
  const [today, setToday] = useState(siteToday);
  const [selectedDate, setSelectedDate] = useState(siteToday);
  const syncToday = useCallback(() => {
    setToday((current) => {
      const next = siteToday();
      setSelectedDate((selected) => (selected === current ? next : selected));
      return next;
    });
  }, []);
  useEffect(() => {
    const timer = setInterval(syncToday, 60_000);
    return () => clearInterval(timer);
  }, [syncToday]);
  useFocusEffect(
    useCallback(() => {
      syncToday();
      void refresh();
    }, [refresh, syncToday]),
  );

  const busy = project.isFetching || work.isFetching;
  const error = project.error || work.error;
  const context = project.data;
  const data = work.data;
  const groups =
    context && data && !error
      ? groupMyWork(
          data.snapshot.activities,
          data.assignments,
          context.member.user_id,
          selectedDate,
        )
      : null;
  const tasks = groups?.find((group) => group.title === 'Today')?.items ?? [];

  return (
    <ScrollView
      contentContainerStyle={shellStyles.scroll}
      refreshControl={
        <RefreshControl
          colors={['#7655d9']}
          enabled={!offline}
          onRefresh={() => void refresh()}
          refreshing={busy}
          testID="my-tasks-refresh"
          tintColor="#7655d9"
        />
      }
      style={shellStyles.screen}
      testID="my-tasks-scroll"
    >
      <View style={[shellStyles.content, styles.content]}>
        <TaskHeader displayName={context?.member.display_name ?? 'Nirmaan'} />

        <View style={styles.dateNavigator}>
          <Pressable
            accessibilityLabel="Previous day"
            accessibilityRole="button"
            onPress={() =>
              setSelectedDate((current) => shiftSiteDate(current, -1))
            }
            style={styles.dateArrow}
          >
            <Feather color="#667582" name="chevron-left" size={20} />
          </Pressable>
          <View style={styles.datePill}>
            <Feather color="#7655d9" name="calendar" size={16} />
            <Text style={styles.dateText}>
              {taskDateLabel(selectedDate, today, t('TODAY'))}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Next day"
            accessibilityRole="button"
            onPress={() =>
              setSelectedDate((current) => shiftSiteDate(current, 1))
            }
            style={styles.dateArrow}
          >
            <Feather color="#667582" name="chevron-right" size={20} />
          </Pressable>
        </View>

        {offline && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {data && !error
              ? 'Offline · Showing previously loaded work. Assignments may have changed.'
              : 'Offline · Connect to load your assigned work.'}
          </Text>
        )}

        {error ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.stateTitle}>
              Work unavailable
            </Text>
            <Text style={shellStyles.body}>{error.message}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={offline || busy}
              onPress={() => void refresh()}
              style={[styles.retry, (offline || busy) && styles.disabled]}
            >
              <Text style={styles.retryText}>Refresh</Text>
            </Pressable>
          </View>
        ) : project.isPending ? (
          <View style={styles.state}>
            {!offline && <ActivityIndicator color="#7655d9" />}
            <Text style={shellStyles.body}>
              {offline
                ? 'Project access has not been loaded.'
                : 'Loading your project access…'}
            </Text>
          </View>
        ) : !context ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No active project access</Text>
            <Text style={shellStyles.body}>
              Ask your project manager to check your membership, then refresh.
            </Text>
          </View>
        ) : !data ? (
          <View style={styles.state}>
            {!offline && <ActivityIndicator color="#7655d9" />}
            <Text style={shellStyles.body}>
              {offline
                ? 'No work has been loaded for this project.'
                : 'Loading your assigned work…'}
            </Text>
          </View>
        ) : data.snapshot.revisionId === null ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No active schedule</Text>
            <Text style={shellStyles.body}>
              A planner has not activated a schedule for this project.
            </Text>
          </View>
        ) : (
          <>
            <Text numberOfLines={1} style={styles.projectName}>
              {context.project.name}
            </Text>
            {tasks.length ? (
              <View style={styles.taskList}>
                {tasks.map((item) => (
                  <WorkCard item={item} key={item.activity.id} today={today} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Feather color="#87949d" name="calendar" size={24} />
                <Text style={styles.emptyTitle}>
                  No assignment for this date.
                </Text>
                <Text style={styles.emptyCopy}>
                  {['planner', 'manager'].includes(context.member.role)
                    ? 'This is your personal task list. Open Manager Schedule to see all project activities.'
                    : 'Use the arrows to check another day.'}
                </Text>
                {['planner', 'manager'].includes(context.member.role) && (
                  <NavLink
                    href="/manager/schedule"
                    label="View project schedule"
                  />
                )}
              </View>
            )}
            {['supervisor', 'planner', 'manager'].includes(
              context.member.role,
            ) && (
              <NavLink
                href={'/field-verifications' as Href}
                label="Supervisor checks"
                detail="Open independent work checks assigned to you in this project."
              />
            )}
            <Text style={styles.footer}>
              Percentages show accepted progress. Quantity alone does not mark a
              task complete.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8eff3',
  },
  avatarText: { color: '#17354c', fontSize: 16, fontWeight: '800' },
  heading: {
    color: '#17283a',
    fontSize: 21,
    lineHeight: 28,
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
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  dateArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e7eb',
  },
  datePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0eaff',
  },
  dateText: {
    color: '#7655d9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  projectName: {
    color: '#6b7983',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  taskList: { gap: 11 },
  taskCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7ebee',
    borderLeftWidth: 5,
    shadowColor: '#17354c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 2,
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskBody: { flex: 1, minWidth: 0 },
  taskName: {
    color: '#233443',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  taskMeta: { color: '#87939c', fontSize: 10, lineHeight: 15, marginTop: 1 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 7,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e9edf0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPercent: {
    width: 31,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  quantity: { color: '#697984', fontSize: 10, lineHeight: 15, marginTop: 4 },
  statusPill: {
    minWidth: 58,
    minHeight: 29,
    borderRadius: 15,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 9, lineHeight: 13, fontWeight: '900' },
  notice: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  state: {
    marginTop: 18,
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
  },
  stateTitle: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  retry: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7655d9',
  },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  emptyCard: {
    minHeight: 150,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 7,
    borderWidth: 1,
    borderColor: '#e7ebee',
  },
  emptyTitle: {
    color: '#344654',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  emptyCopy: {
    color: '#7a8993',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  footer: {
    color: '#73828c',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    textAlign: 'center',
  },
});
