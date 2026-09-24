import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
} from '@/features/localization/LocalizedText';
import {
  getActiveLocaleTag,
  useLocalization,
} from '@/features/localization/LocalizationProvider';

import { NavLink, ShellPage, shellStyles } from '@/features/navigation/shellUi';

import { groupMyWork, siteToday } from './myWork';
import { useMyWork } from './useMyWork';

import type { WorkActivity, WorkItem } from './myWork';
import type { Href } from 'expo-router';

function dateLabel(date: string | null) {
  if (!date) return 'Not recorded';
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

// Preserve the supplied number's significant digits instead of rounding to three decimals.
function quantityLabel(activity: WorkActivity) {
  const quantityFormatter = new Intl.NumberFormat(getActiveLocaleTag(), {
    maximumSignificantDigits: 21,
  });
  const accepted = quantityFormatter.format(activity.acceptedQuantity);
  const unit = activity.unit ? ` ${activity.unit}` : ' (unit not recorded)';
  if (activity.targetQuantity === null)
    return `${accepted}${unit} accepted · Planned quantity not recorded`;
  return `${accepted} of ${quantityFormatter.format(activity.targetQuantity)}${unit} accepted`;
}

function WorkCard({ item }: { item: WorkItem }) {
  const { activity: a, assignment } = item;
  const status = a.actualFinish
    ? 'Complete'
    : a.actualStart
      ? 'In progress'
      : a.reportedProgress
        ? 'Progress reported · start unresolved'
        : 'Assigned';
  return (
    <View style={shellStyles.card}>
      <Text style={styles.identifier}>
        {a.externalId} · {a.discipline}
      </Text>
      <Text style={styles.badge}>{status}</Text>
      <Text accessibilityRole="header" style={shellStyles.cardTitle}>
        {a.name}
      </Text>
      <Text style={shellStyles.body}>{a.location}</Text>
      <Text style={styles.detail}>
        {dateLabel(assignment.effective_from)} –{' '}
        {dateLabel(assignment.effective_to)}
      </Text>
      <Text style={styles.quantity}>{quantityLabel(a)}</Text>
      {a.acceptedPercent != null && (
        <Text style={styles.detail}>
          Accepted progress: {a.acceptedPercent}% · Basis:{' '}
          {a.percentBasis || 'Not recorded'}
        </Text>
      )}
      {a.acceptedPercent != null && (
        <Text style={styles.detail}>
          Progress as of: {dateLabel(a.progressAsOf ?? null)}
        </Text>
      )}
      <Text style={styles.detail}>
        Actual start: {dateLabel(a.actualStart)}
      </Text>
      <Text style={styles.detail}>
        Actual finish: {dateLabel(a.actualFinish)}
      </Text>
      {a.nodeKind === 'milestone' && (
        <Text style={styles.detail}>
          Milestone date: {dateLabel(a.milestoneDate ?? null)}
        </Text>
      )}
      <Text style={styles.detail}>Assignment v{assignment.version}</Text>
      <NavLink
        href={`/task-hierarchy/${a.id}` as Href}
        label="Open task hierarchy"
      />
    </View>
  );
}

export function MyWorkScreen() {
  useLocalization();
  const { project, work, refresh, offline } = useMyWork();
  const [today, setToday] = useState(siteToday);
  // Keep date-only grouping correct across midnight and tab re-entry, without polling the backend.
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
          today,
        )
      : null;
  const count =
    groups?.reduce((total, group) => total + group.items.length, 0) ?? 0;

  return (
    <ShellPage title="My work" eyebrow="FIELD · ASSIGNED ACTIVITIES">
      <Text style={shellStyles.body}>
        Your assigned activities and the work coming next.
      </Text>
      <View style={styles.toolbar}>
        <Text style={styles.detail}>
          {dateLabel(today)} · India Standard Time
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: offline || busy }}
          disabled={offline || busy}
          onPress={() => void refresh()}
          style={[styles.refresh, (offline || busy) && styles.disabled]}
        >
          <Text style={shellStyles.linkText}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </Text>
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
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Work unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending ? (
        <View style={styles.state}>
          {!offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {offline
              ? 'Project access has not been loaded.'
              : 'Loading your project access…'}
          </Text>
        </View>
      ) : !context ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Ask your project manager to check your membership, then refresh.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.project}>{context.project.name}</Text>
          <Text style={styles.detail}>
            {context.member.display_name || 'Name not recorded'} · Selected
            project
          </Text>
          {['supervisor', 'planner', 'manager'].includes(
            context.member.role,
          ) && (
            <NavLink
              href={'/field-verifications' as Href}
              label="Supervisor checks"
              detail="Open independent work checks assigned to you in this project."
            />
          )}
          {!data ? (
            <View style={styles.state}>
              {!offline && <ActivityIndicator color="#266b8c" />}
              <Text style={shellStyles.body}>
                {offline
                  ? 'No work has been loaded for this project.'
                  : 'Loading your assigned work…'}
              </Text>
            </View>
          ) : data.snapshot.revisionId === null ? (
            <View style={styles.state}>
              <Text style={shellStyles.cardTitle}>No active schedule</Text>
              <Text style={shellStyles.body}>
                A planner has not activated a schedule for this project.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.count}>
                {count} assigned {count === 1 ? 'activity' : 'activities'}
              </Text>
              {count === 0 && (
                <Text style={styles.notice}>
                  No activities are assigned to you in this project. Ask your
                  supervisor to check your assignments.
                </Text>
              )}
              {groups?.map((group) => (
                <View key={group.title} style={styles.group}>
                  <View style={styles.groupHeading}>
                    <Text accessibilityRole="header" style={styles.groupTitle}>
                      {group.title}
                    </Text>
                    <Text style={styles.detail}>{group.items.length}</Text>
                  </View>
                  {group.items.length ? (
                    group.items.map((item) => (
                      <WorkCard key={item.activity.id} item={item} />
                    ))
                  ) : (
                    <Text style={styles.empty}>
                      {group.title === 'Today'
                        ? 'No assignment today.'
                        : 'No assignments in this period.'}
                    </Text>
                  )}
                </View>
              ))}
              <Text style={styles.footer}>
                Earlier assignments are not automatically complete. Actual
                progress requires an accepted field report.
              </Text>
            </>
          )}
        </>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  refresh: {
    minHeight: 48,
    minWidth: 88,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
  },
  disabled: { opacity: 0.55 },
  detail: { color: '#586c7a', fontSize: 14, lineHeight: 22 },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginVertical: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  project: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  count: { color: '#17354c', fontSize: 16, lineHeight: 24, marginTop: 20 },
  group: { marginTop: 28 },
  groupHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  groupTitle: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  identifier: {
    color: '#627786',
    fontSize: 13,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  badge: {
    color: '#76541d',
    backgroundColor: '#fff2d9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    lineHeight: 20,
  },
  quantity: {
    color: '#266b8c',
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
    borderTopColor: '#d7e0e5',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  empty: {
    color: '#586c7a',
    fontSize: 15,
    lineHeight: 24,
    paddingVertical: 16,
  },
  footer: { color: '#586c7a', fontSize: 14, lineHeight: 24, marginTop: 28 },
});
