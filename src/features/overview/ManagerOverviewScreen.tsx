import Feather from '@expo/vector-icons/Feather';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { shellStyles } from '@/features/navigation/shellUi';
import { siteToday } from '@/features/projects/myWork';

import {
  acceptedEventDays,
  attentionReason,
  disciplineProgress,
  overviewSummary,
  recentAcceptedEvents,
} from './overviewModel';
import { useManagerOverview } from './useManagerOverview';

import type { Href } from 'expo-router';

const chartColors = ['#26bf69', '#f5a623', '#4485e3', '#7655d9', '#ef6262'];
const DONUT_SEGMENTS = 36;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function acceptedLabel(value: string) {
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
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

function OverviewHeader({ displayName }: { displayName: string }) {
  const initial = displayName.trim().charAt(0).toLocaleUpperCase() || 'N';
  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Progress Overview
        </Text>
      </View>
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
  );
}

function ActivityDonut({ percent }: { percent: number | null }) {
  const activeSegments =
    percent === null ? 0 : Math.round((percent / 100) * DONUT_SEGMENTS);
  return (
    <View
      accessibilityLabel={
        percent === null
          ? 'Total activity completion not recorded'
          : `${percent}% total activity-count completion`
      }
      accessibilityRole="progressbar"
      accessibilityValue={
        percent === null
          ? { text: 'Not recorded' }
          : { min: 0, max: 100, now: percent }
      }
      style={styles.donut}
    >
      {Array.from({ length: DONUT_SEGMENTS }, (_, index) => {
        const angle = (index / DONUT_SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        return (
          <View
            key={index}
            style={[
              styles.donutSegment,
              {
                backgroundColor: index < activeSegments ? '#26bf69' : '#dce7df',
                left: 54 + 43 * Math.cos(angle) - 2,
                top: 54 + 43 * Math.sin(angle) - 6,
                transform: [{ rotate: `${(index * 360) / DONUT_SEGMENTS}deg` }],
              },
            ]}
          />
        );
      })}
      <View style={styles.donutCenter}>
        <Text style={styles.donutValue}>
          {percent === null ? '—' : `${percent}%`}
        </Text>
        <Text style={styles.donutLabel}>TOTAL</Text>
      </View>
    </View>
  );
}

export function ManagerOverviewScreen() {
  useLocalization();
  const { project, overview, refresh, authorized } = useManagerOverview();
  const [today, setToday] = useState(siteToday);
  const data = overview.data;
  const busy = project.isFetching || overview.isFetching;
  const error = project.error || overview.error;
  const summary = data
    ? overviewSummary(data.snapshot.activities, data.actionableCount)
    : null;
  const disciplines = data ? disciplineProgress(data.snapshot.activities) : [];
  const days = data ? acceptedEventDays(data.history, today) : [];
  const recent = data ? recentAcceptedEvents(data.history) : [];
  const largestDay = Math.max(1, ...days.map((day) => day.count));

  useFocusEffect(
    useCallback(() => {
      setToday(siteToday());
      void refresh();
    }, [refresh]),
  );

  return (
    <ScrollView
      contentContainerStyle={shellStyles.scroll}
      refreshControl={
        <RefreshControl
          colors={['#7655d9']}
          enabled={!project.offline}
          onRefresh={() => void refresh()}
          refreshing={busy}
          tintColor="#7655d9"
        />
      }
      style={shellStyles.screen}
      testID="progress-overview-scroll"
    >
      <View style={[shellStyles.content, styles.content]}>
        <OverviewHeader
          displayName={project.data?.member.display_name ?? 'Nirmaan'}
        />
        {project.offline && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {data && !error
              ? 'Offline · Showing the last loaded overview. Counts may have changed.'
              : 'Offline · Connect to load the execution overview.'}
          </Text>
        )}
        {error ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.stateTitle}>
              Overview unavailable
            </Text>
            <Text style={shellStyles.body}>{error.message}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={project.offline || busy}
              onPress={() => void refresh()}
              style={[
                styles.retry,
                (project.offline || busy) && styles.disabled,
              ]}
            >
              <Text style={styles.retryText}>Refresh</Text>
            </Pressable>
          </View>
        ) : project.isPending ? (
          <View style={styles.state}>
            {!project.offline && <ActivityIndicator color="#7655d9" />}
            <Text style={shellStyles.body}>
              {project.offline
                ? 'Project access has not been loaded.'
                : 'Loading your project access…'}
            </Text>
          </View>
        ) : !project.data ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No active project access</Text>
            <Text style={shellStyles.body}>
              Select an active project or ask an administrator to check your
              membership.
            </Text>
          </View>
        ) : !authorized ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>Manager access required</Text>
            <Text style={shellStyles.body}>
              Overview aggregates are available to active planners and managers.
            </Text>
          </View>
        ) : !data || !summary ? (
          <View style={styles.state}>
            {!project.offline && <ActivityIndicator color="#7655d9" />}
            <Text style={shellStyles.body}>
              {project.offline
                ? 'No overview has been loaded for this project.'
                : 'Loading the accepted schedule and review context…'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.projectMeta}>
              <Text numberOfLines={1} style={styles.projectName}>
                {project.data.project.name}
              </Text>
              <Text style={styles.revisionLabel}>
                {data.snapshot.revisionLabel ?? 'No active schedule'} · Schedule
                v{data.snapshot.scheduleVersion}
              </Text>
            </View>

            {data.snapshot.revisionId === null && (
              <Text style={styles.notice}>
                No active reporting schedule. Review and accepted evidence
                remain visible, while activity counts stay at zero.
              </Text>
            )}

            <View style={styles.overviewCard}>
              <ActivityDonut percent={summary.completionPercent} />
              <View style={styles.legend}>
                {disciplines.length ? (
                  disciplines.map((row, index) => (
                    <View key={row.discipline} style={styles.legendRow}>
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor:
                              chartColors[index % chartColors.length],
                          },
                        ]}
                      />
                      <Text numberOfLines={1} style={styles.legendText}>
                        <Text style={styles.legendPercent}>{row.percent}%</Text>{' '}
                        {row.discipline}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyInline}>
                    No active disciplines recorded
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.basis}>
              Total is {summary.completed} accepted-finished of{' '}
              {summary.planned} planned activities. It does not weight quantity,
              duration or cost.
            </Text>
            {summary.unresolvedProgress > 0 && (
              <Text style={styles.warning}>
                {summary.unresolvedProgress}{' '}
                {summary.unresolvedProgress === 1
                  ? 'activity has'
                  : 'activities have'}{' '}
                reported progress without an accepted start date.
              </Text>
            )}

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              WORK AREA COMPLETE
            </Text>
            <View style={styles.chartCard}>
              {disciplines.length ? (
                disciplines.map((row, index) => {
                  const color = chartColors[index % chartColors.length]!;
                  return (
                    <View key={row.discipline} style={styles.progressRow}>
                      <View style={styles.progressHeading}>
                        <Text style={styles.progressTitle}>
                          {row.discipline}
                        </Text>
                        <Text style={[styles.progressPercent, { color }]}>
                          {row.percent}%
                        </Text>
                      </View>
                      <View
                        accessibilityLabel={`${row.discipline}: ${row.completed} of ${row.planned} activities complete`}
                        style={styles.track}
                      >
                        <View
                          style={[
                            styles.fill,
                            {
                              backgroundColor: color,
                              width: `${row.percent}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressFacts}>
                        {row.completed} of {row.planned} accepted-finished ·{' '}
                        {row.inProgress} in progress
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyInline}>
                  No active schedule activities are available by discipline.
                </Text>
              )}
            </View>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              WEEKLY PROGRESS TREND
            </Text>
            <Text style={styles.basis}>
              Accepted field events by work date · evidence volume, not
              productivity.
            </Text>
            <View style={styles.trendCard}>
              {days.map((day) => {
                const height = day.count
                  ? 18 + (day.count / largestDay) * 54
                  : 8;
                return (
                  <View
                    accessibilityLabel={`${dateLabel(day.date)}: ${day.count} accepted ${day.count === 1 ? 'event' : 'events'}`}
                    key={day.date}
                    style={styles.dayColumn}
                  >
                    <Text style={styles.dayCount}>
                      {day.count ? day.count : ''}
                    </Text>
                    <View
                      style={[
                        styles.dayBar,
                        {
                          backgroundColor: day.count ? '#26bf69' : '#c8d0d5',
                          height,
                        },
                      ]}
                    />
                    <Text style={styles.dayLabel}>{day.day}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  NEEDS YOUR ATTENTION
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {summary.actionableClaims}{' '}
                  {summary.actionableClaims === 1 ? 'claim' : 'claims'} awaiting
                  action
                </Text>
              </View>
              <Link href={'/manager/review' as Href} asChild>
                <Pressable accessibilityRole="button" style={styles.linkButton}>
                  <Text style={styles.linkText}>Open review</Text>
                </Pressable>
              </Link>
            </View>
            {data.attention.length ? (
              data.attention.map((claim) => (
                <View key={claim.id} style={styles.attentionCard}>
                  <Text style={styles.attentionTag}>
                    {attentionReason(claim)}
                  </Text>
                  <Text accessibilityRole="header" style={styles.cardTitle}>
                    {claim.facts.activityHint ?? claim.facts.evidenceQuote}
                  </Text>
                  <Text style={styles.detail}>
                    {claim.facts.kind.replaceAll('_', ' ')} ·{' '}
                    {claim.facts.eventDate
                      ? dateLabel(claim.facts.eventDate)
                      : 'Work date not recorded'}
                  </Text>
                  <Text style={styles.quote}>
                    “{claim.facts.evidenceQuote}”
                  </Text>
                  <Link href={`/manager/review/${claim.id}` as Href} asChild>
                    <Pressable
                      accessibilityLabel={`Review ${claim.facts.activityHint ?? 'claim'}`}
                      accessibilityRole="button"
                      style={styles.inlineLink}
                    >
                      <Text style={styles.linkText}>Review claim</Text>
                      <Feather color="#7655d9" name="arrow-right" size={15} />
                    </Pressable>
                  </Link>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>
                No field claims currently need a planner decision or follow-up.
              </Text>
            )}
            {data.actionableCount > data.attention.length && (
              <Text style={styles.basis}>
                Showing {data.attention.length} of {data.actionableCount}{' '}
                current claims. Open Review for the complete paged list.
              </Text>
            )}

            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                RECENT ACCEPTED RECORDS
              </Text>
              <Link href={'/manager/history' as Href} asChild>
                <Pressable accessibilityRole="button" style={styles.linkButton}>
                  <Text style={styles.linkText}>Open history</Text>
                </Pressable>
              </Link>
            </View>
            {recent.length ? (
              recent.map((entry) => (
                <View key={entry.eventId} style={styles.acceptedCard}>
                  <Text style={styles.acceptedTag}>{entry.discipline}</Text>
                  <Text style={styles.acceptedTitle}>
                    {entry.externalId} · {entry.activityName}
                  </Text>
                  <Text style={styles.detail}>
                    {eventLabel(entry.eventKind)}
                  </Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9eef2',
  },
  avatarText: { color: '#17354c', fontSize: 16, fontWeight: '800' },
  title: { color: '#17283a', fontSize: 19, lineHeight: 26, fontWeight: '800' },
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
  projectMeta: { marginBottom: 12 },
  projectName: { color: '#344653', fontSize: 13, fontWeight: '800' },
  revisionLabel: { color: '#84919a', fontSize: 11, lineHeight: 17 },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
    shadowColor: '#17354c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  donut: { width: 108, height: 108, position: 'relative' },
  donutSegment: {
    position: 'absolute',
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  donutCenter: {
    position: 'absolute',
    left: 18,
    top: 18,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  donutValue: {
    color: '#293c49',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  donutLabel: {
    color: '#26aa61',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
  },
  legend: { flex: 1, minWidth: 0, gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flex: 1, color: '#5f6f7a', fontSize: 11, lineHeight: 16 },
  legendPercent: { color: '#314552', fontWeight: '900' },
  basis: { color: '#72818b', fontSize: 11, lineHeight: 17, marginTop: 8 },
  warning: {
    color: '#835d17',
    backgroundColor: '#fff3d6',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#455660',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.55,
    marginTop: 20,
  },
  chartCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
    gap: 13,
  },
  progressRow: { gap: 5 },
  progressHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    color: '#43545f',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  progressPercent: { fontSize: 11, lineHeight: 16, fontWeight: '900' },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e7ecef',
    overflow: 'hidden',
  },
  fill: { height: 7, borderRadius: 4 },
  progressFacts: { color: '#8a969e', fontSize: 9, lineHeight: 13 },
  trendCard: {
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
  },
  dayColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  dayCount: {
    minHeight: 15,
    color: '#72818b',
    fontSize: 9,
    lineHeight: 13,
  },
  dayBar: { width: 12, minHeight: 8, borderRadius: 3 },
  dayLabel: {
    color: '#6f7d86',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    fontWeight: '700',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionSubtitle: {
    color: '#84919a',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  linkButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f1edff',
  },
  linkText: { color: '#7655d9', fontSize: 11, fontWeight: '800' },
  attentionCard: {
    marginTop: 9,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
    gap: 4,
  },
  attentionTag: {
    alignSelf: 'flex-start',
    color: '#936414',
    backgroundColor: '#fff2d4',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#314552',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  detail: { color: '#73818b', fontSize: 11, lineHeight: 17 },
  quote: { color: '#465a67', fontSize: 12, lineHeight: 18 },
  inlineLink: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
  acceptedCard: {
    marginTop: 9,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8eb',
    gap: 3,
  },
  acceptedTag: {
    alignSelf: 'flex-start',
    color: '#397795',
    backgroundColor: '#e7f2f7',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  acceptedTitle: {
    color: '#314552',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  notice: {
    color: '#315a70',
    backgroundColor: '#e8f1f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  state: { marginTop: 22, gap: 12, alignItems: 'flex-start' },
  stateTitle: {
    color: '#17354c',
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#7655d9',
  },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  empty: {
    color: '#73818b',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5eaed',
    padding: 14,
    marginTop: 9,
    fontSize: 12,
    lineHeight: 19,
  },
  emptyInline: { color: '#84919a', fontSize: 11, lineHeight: 17 },
  footer: { color: '#73818b', fontSize: 11, lineHeight: 18, marginTop: 20 },
});
