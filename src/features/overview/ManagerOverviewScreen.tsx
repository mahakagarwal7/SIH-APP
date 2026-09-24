import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NavLink, ShellPage, shellStyles } from '@/features/navigation/shellUi';
import { siteToday } from '@/features/projects/myWork';

import {
  acceptedEventWeeks,
  attentionReason,
  disciplineProgress,
  overviewSummary,
  recentAcceptedEvents,
} from './overviewModel';
import { useManagerOverview } from './useManagerOverview';

import type { Href } from 'expo-router';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function acceptedLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function eventLabel(kind: string) {
  return kind === 'START'
    ? 'Actual start accepted'
    : kind === 'FINISH'
      ? 'Actual finish accepted'
      : kind === 'MILESTONE'
        ? 'Milestone accepted'
        : kind === 'PERCENT_PROGRESS'
          ? 'Percentage evidence accepted'
          : 'Quantity evidence accepted';
}

export function ManagerOverviewScreen() {
  const { project, overview, refresh, authorized } = useManagerOverview();
  const [today, setToday] = useState(siteToday);
  const data = overview.data;
  const busy = project.isFetching || overview.isFetching;
  const error = project.error || overview.error;
  const summary = data
    ? overviewSummary(data.snapshot.activities, data.actionableCount)
    : null;
  const disciplines = data ? disciplineProgress(data.snapshot.activities) : [];
  const weeks = data ? acceptedEventWeeks(data.history, today) : [];
  const recent = data ? recentAcceptedEvents(data.history) : [];
  const largestWeek = Math.max(1, ...weeks.map((week) => week.count));

  useFocusEffect(
    useCallback(() => {
      setToday(siteToday());
      void refresh();
    }, [refresh]),
  );

  return (
    <ShellPage title="Execution overview" eyebrow="MANAGER · ACCEPTED RECORD">
      <Text style={shellStyles.body}>
        Start with decisions waiting for you, then inspect accepted execution.
      </Text>
      <View style={styles.toolbar}>
        <Text style={styles.detail}>
          {project.data?.project.name || 'No project selected'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: project.offline || busy }}
          disabled={project.offline || busy}
          onPress={() => void refresh()}
          style={[styles.refresh, (project.offline || busy) && styles.disabled]}
        >
          <Text style={shellStyles.linkText}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
      {project.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {data && !error
            ? 'Offline · Showing the last loaded overview. Counts may have changed.'
            : 'Offline · Connect to load the execution overview.'}
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Overview unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'Project access has not been loaded.'
              : 'Loading your project access…'}
          </Text>
        </View>
      ) : !project.data ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Select an active project or ask an administrator to check your
            membership.
          </Text>
        </View>
      ) : !authorized ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>Manager access required</Text>
          <Text style={shellStyles.body}>
            Overview aggregates are available to active planners and managers.
          </Text>
        </View>
      ) : !data || !summary ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'No overview has been loaded for this project.'
              : 'Loading the accepted schedule and review context…'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.revision}>
            <Text style={styles.revisionTitle}>
              {data.snapshot.revisionLabel ?? 'No active schedule'}
            </Text>
            <Text style={styles.detail}>
              Schedule v{data.snapshot.scheduleVersion} · Activity-count basis
            </Text>
          </View>
          {data.snapshot.revisionId === null && (
            <Text style={styles.notice}>
              No active reporting schedule. Review and accepted evidence remain
              visible, while activity counts stay at zero.
            </Text>
          )}

          <View style={styles.stats} accessibilityLabel="Execution counts">
            {[
              [summary.planned, 'Planned activities'],
              [summary.completed, 'Completed activities'],
              [summary.inProgress, 'In progress'],
              [summary.actionableClaims, 'Claims needing action'],
            ].map(([value, label]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {summary.unresolvedProgress > 0 && (
            <Text style={styles.warning}>
              {summary.unresolvedProgress}{' '}
              {summary.unresolvedProgress === 1
                ? 'activity has'
                : 'activities have'}{' '}
              reported progress without an accepted start date.
            </Text>
          )}
          <Text style={styles.basis}>
            Completion means an accepted actual finish. Counts do not weight
            quantities, duration or cost.
          </Text>

          <View style={styles.sectionHeading}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.inlineSectionTitle]}
            >
              Needs your attention
            </Text>
            <NavLink
              href={'/manager/review' as Href}
              label="Open review queue"
            />
          </View>
          {data.attention.length ? (
            data.attention.map((claim) => (
              <View key={claim.id} style={shellStyles.card}>
                <Text style={styles.attentionTag}>
                  {attentionReason(claim)}
                </Text>
                <Text accessibilityRole="header" style={shellStyles.cardTitle}>
                  {claim.facts.activityHint ?? claim.facts.evidenceQuote}
                </Text>
                <Text style={styles.detail}>
                  {claim.facts.kind.replaceAll('_', ' ')} ·{' '}
                  {claim.facts.eventDate
                    ? dateLabel(claim.facts.eventDate)
                    : 'Work date not recorded'}
                </Text>
                <Text style={styles.quote}>“{claim.facts.evidenceQuote}”</Text>
                <NavLink
                  href={`/manager/review/${claim.id}` as Href}
                  label="Review claim"
                />
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              No field claims currently need a planner decision or follow-up.
            </Text>
          )}
          {data.actionableCount > data.attention.length && (
            <Text style={styles.basis}>
              Showing {data.attention.length} of {data.actionableCount} current
              claims. Open the queue for the complete paged list.
            </Text>
          )}

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Activity completion by discipline
          </Text>
          {disciplines.length ? (
            disciplines.map((row) => (
              <View key={row.discipline} style={styles.progressRow}>
                <View style={styles.progressHeading}>
                  <Text style={styles.progressTitle}>{row.discipline}</Text>
                  <Text style={styles.detail}>
                    {row.completed} of {row.planned} complete · {row.inProgress}{' '}
                    in progress
                  </Text>
                </View>
                <View
                  accessibilityLabel={`${row.discipline}: ${row.completed} of ${row.planned} activities complete`}
                  style={styles.track}
                >
                  <View style={[styles.fill, { width: `${row.percent}%` }]} />
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              No active schedule activities are available by discipline.
            </Text>
          )}

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Weekly accepted field events
          </Text>
          <Text style={styles.basis}>
            Effective accepted events by recorded work date, Monday to Sunday.
            This is evidence volume, not productivity.
          </Text>
          {weeks.map((week) => (
            <View key={week.start} style={styles.weekRow}>
              <Text style={styles.weekLabel}>
                {dateLabel(week.start)} – {dateLabel(week.end)}
              </Text>
              <View style={styles.weekTrack}>
                <View
                  style={[
                    styles.weekFill,
                    { width: `${(week.count / largestWeek) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.weekCount}>{week.count}</Text>
            </View>
          ))}

          <View style={styles.sectionHeading}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.inlineSectionTitle]}
            >
              Recent accepted records
            </Text>
            <NavLink href={'/manager/history' as Href} label="Open history" />
          </View>
          {recent.length ? (
            recent.map((entry) => (
              <View key={entry.eventId} style={styles.acceptedCard}>
                <Text style={styles.acceptedTag}>{entry.discipline}</Text>
                <Text style={styles.acceptedTitle}>
                  {entry.externalId} · {entry.activityName}
                </Text>
                <Text style={styles.detail}>{eventLabel(entry.eventKind)}</Text>
                <Text style={styles.quote}>“{entry.quote}”</Text>
                <Text style={styles.detail}>
                  Accepted {acceptedLabel(entry.acceptedAt)} by{' '}
                  {entry.reviewer ?? 'Project planner'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>
              No current accepted field records are available yet.
            </Text>
          )}
          <Text style={styles.footer}>
            Accepted evidence retains its source report and review decision in
            History. Pending claims do not change accepted schedule counts.
          </Text>
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
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 14,
    marginVertical: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  warning: {
    backgroundColor: '#fff2d9',
    color: '#76541d',
    padding: 14,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  revision: {
    borderTopColor: '#d7e0e5',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
    gap: 3,
  },
  revisionTitle: { color: '#17354c', fontSize: 17, fontWeight: '600' },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  stat: {
    minWidth: '46%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  statValue: {
    color: '#17354c',
    fontFamily: 'serif',
    fontSize: 30,
    lineHeight: 38,
  },
  statLabel: { color: '#627786', fontSize: 13, lineHeight: 20 },
  basis: { color: '#627786', fontSize: 13, lineHeight: 21, marginTop: 10 },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
    marginTop: 28,
  },
  inlineSectionTitle: { marginTop: 0 },
  attentionTag: {
    color: '#76541d',
    backgroundColor: '#fff2d9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    lineHeight: 20,
  },
  quote: { color: '#17354c', fontSize: 14, lineHeight: 23 },
  empty: {
    color: '#627786',
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
  },
  progressRow: {
    backgroundColor: '#fff',
    borderBottomColor: '#d7e0e5',
    borderBottomWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 9,
  },
  progressHeading: { gap: 2 },
  progressTitle: { color: '#17354c', fontSize: 16, fontWeight: '600' },
  track: { height: 8, backgroundColor: '#e8eff3', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#266b8c' },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  weekLabel: { color: '#627786', fontSize: 11, lineHeight: 18, width: 112 },
  weekTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#e8eff3',
    overflow: 'hidden',
  },
  weekFill: { height: 10, backgroundColor: '#3d7a66' },
  weekCount: {
    color: '#17354c',
    width: 24,
    textAlign: 'right',
    fontWeight: '600',
  },
  acceptedCard: {
    borderBottomColor: '#d7e0e5',
    borderBottomWidth: 1,
    paddingVertical: 16,
    gap: 5,
  },
  acceptedTag: {
    color: '#3d6c83',
    backgroundColor: '#dfedf4',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 12,
  },
  acceptedTitle: {
    color: '#17354c',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  footer: { color: '#627786', fontSize: 13, lineHeight: 22, marginTop: 24 },
});
