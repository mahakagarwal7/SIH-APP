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

import { useLocalization } from '@/features/localization/LocalizationProvider';
import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';
import { shellStyles } from '@/features/navigation/shellUi';

import {
  disciplineProgress,
  overviewSummary,
  recentAcceptedEvents,
  relativeAcceptedTime,
  verifiedReporterLabel,
} from './overviewModel';
import { useManagerOverview } from './useManagerOverview';

import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

const chartColors = ['#26bf69', '#f5a623', '#4485e3', '#7655d9', '#ef6262'];

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

function ManagerHeader({
  projectName,
  scheduleLabel,
  showHealth,
}: {
  projectName?: string;
  scheduleLabel?: string;
  showHealth: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          Manager Panel
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
      {projectName && (
        <View style={styles.projectRow}>
          <View style={styles.projectCopy}>
            <Text style={styles.projectName}>{projectName}</Text>
            {scheduleLabel && (
              <Text style={styles.revisionLabel}>{scheduleLabel}</Text>
            )}
          </View>
          {showHealth && (
            <View
              accessibilityLabel="Project health: Not recorded"
              style={styles.healthPill}
            >
              <View style={styles.healthDot} />
              <Text style={styles.healthValue}>Not recorded</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Feather color="#7655d9" name={icon} size={18} />
      <Text
        numberOfLines={2}
        style={[styles.metricValue, value === 'Not recorded' && styles.unknown]}
      >
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function ManagerOverviewScreen() {
  useLocalization();
  const { project, overview, refresh, authorized } = useManagerOverview();
  const data = overview.data;
  const busy = project.isFetching || overview.isFetching;
  const error = project.error || overview.error;
  const summary = data
    ? overviewSummary(data.snapshot.activities, data.actionableCount)
    : null;
  const disciplines = data ? disciplineProgress(data.snapshot.activities) : [];
  const recent = data ? recentAcceptedEvents(data.history) : [];
  const [renderedAt, setRenderedAt] = useState(Date.now);

  useFocusEffect(
    useCallback(() => {
      setRenderedAt(Date.now());
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
      testID="manager-panel-scroll"
    >
      <View style={[shellStyles.content, styles.content]}>
        <ManagerHeader
          projectName={project.data?.project.name}
          scheduleLabel={
            data
              ? `${data.snapshot.revisionLabel ?? 'No active schedule'} · Schedule v${data.snapshot.scheduleVersion}`
              : undefined
          }
          showHealth={Boolean(project.data && data && authorized)}
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
            {data.snapshot.revisionId === null && (
              <Text style={styles.notice}>
                No active reporting schedule. Review and accepted evidence
                remain visible, while activity counts stay at zero.
              </Text>
            )}

            <View style={styles.metricsRow}>
              <Metric
                icon="clipboard"
                label="Tasks"
                value={`${summary.completed}/${summary.planned}`}
              />
              <Metric icon="users" label="Workers" value="Not recorded" />
              <Metric icon="alert-circle" label="Delays" value="Not recorded" />
              <Metric
                icon="trending-up"
                label="Variance"
                value="Not recorded"
              />
            </View>
            <Text style={styles.basis}>
              Tasks show accepted completions against the plan. Bars show mean
              accepted progress. Metrics without confirmed data show Not
              recorded.
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

            <View style={styles.sectionHeading}>
              <View style={styles.sectionCopy}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  TIMELINE SCHEDULER
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Mean accepted activity progress by discipline
                </Text>
              </View>
              <Link href={'/manager/schedule' as Href} asChild>
                <Pressable accessibilityRole="button" style={styles.linkButton}>
                  <Text style={styles.linkText}>Open schedule</Text>
                </Pressable>
              </Link>
            </View>
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
                          {row.percent === null
                            ? 'Not recorded'
                            : `${row.percent}%`}
                        </Text>
                      </View>
                      <View
                        accessibilityLabel={
                          row.percent === null
                            ? `${row.discipline}: Progress not recorded`
                            : `${row.discipline}: ${row.percent}% mean accepted progress across ${row.planned} ${row.planned === 1 ? 'activity' : 'activities'}`
                        }
                        accessibilityRole="progressbar"
                        accessibilityValue={{
                          min: 0,
                          max: 100,
                          now: row.percent ?? undefined,
                          text:
                            row.percent === null
                              ? 'Not recorded'
                              : `${row.percent}%`,
                        }}
                        style={styles.track}
                      >
                        <View
                          style={[
                            styles.fill,
                            {
                              backgroundColor: color,
                              width: `${row.percent ?? 0}%`,
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

            <View style={styles.sectionHeading}>
              <View style={styles.sectionCopy}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  RECENT VERIFIED FIELD UPDATES
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Current accepted evidence only
                </Text>
              </View>
              <Link href={'/manager/history' as Href} asChild>
                <Pressable accessibilityRole="button" style={styles.linkButton}>
                  <Text style={styles.linkText}>Open history</Text>
                </Pressable>
              </Link>
            </View>
            <View style={styles.updatesCard}>
              {recent.length ? (
                recent.map((entry, index) => {
                  const reporter = verifiedReporterLabel(entry);
                  return (
                    <View
                      key={entry.eventId}
                      style={[
                        styles.updateRow,
                        index < recent.length - 1 && styles.updateDivider,
                      ]}
                    >
                      <View style={styles.updateAvatar}>
                        <Text style={styles.updateAvatarText}>
                          {reporter.charAt(0).toLocaleUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.updateCopy}>
                        <View style={styles.updateTopline}>
                          <Text numberOfLines={1} style={styles.reporterName}>
                            {reporter}
                          </Text>
                          <Text style={styles.relativeTime}>
                            {relativeAcceptedTime(entry.acceptedAt, renderedAt)}
                          </Text>
                        </View>
                        <Text numberOfLines={2} style={styles.taskName}>
                          {entry.externalId} · {entry.activityName}
                        </Text>
                        <Text style={styles.eventText}>
                          {eventLabel(entry.eventKind)} · {entry.discipline}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyInline}>
                  No verified field updates are available yet.
                </Text>
              )}
            </View>

            <Link href={'/manager/review' as Href} asChild>
              <Pressable accessibilityRole="button" style={styles.reviewCard}>
                <View style={styles.reviewIcon}>
                  <Feather color="#936414" name="check-square" size={18} />
                </View>
                <View style={styles.reviewCopy}>
                  <Text style={styles.reviewTitle}>Pending reviews</Text>
                  <Text style={styles.reviewDetail}>
                    {summary.actionableClaims}{' '}
                    {summary.actionableClaims === 1 ? 'claim' : 'claims'}{' '}
                    awaiting action
                  </Text>
                </View>
                <Feather color="#7655d9" name="arrow-right" size={18} />
              </Pressable>
            </Link>

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
    marginBottom: 4,
  },
  eyebrowRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#7655d9',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
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
  projectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  projectCopy: { flexGrow: 1, flexBasis: '100%', minWidth: 0 },
  projectName: {
    color: '#17283a',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  revisionLabel: {
    color: '#84919a',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },
  healthPill: {
    maxWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#e9eef2',
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8a969e',
  },
  healthValue: {
    color: '#425865',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
  },
  metricsRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  metric: {
    flex: 1,
    minWidth: 0,
    minHeight: 98,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
  },
  metricLabel: {
    color: '#6f7d86',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  metricValue: {
    color: '#314552',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  unknown: {
    color: '#7b8891',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
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
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 20,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: {
    color: '#455660',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.55,
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
  chartCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
    gap: 15,
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
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e7ecef',
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4 },
  progressFacts: { color: '#8a969e', fontSize: 9, lineHeight: 13 },
  updatesCard: {
    marginTop: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
  },
  updateDivider: { borderBottomWidth: 1, borderBottomColor: '#edf0f2' },
  updateAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f2f7',
  },
  updateAvatarText: { color: '#397795', fontSize: 13, fontWeight: '900' },
  updateCopy: { flex: 1, minWidth: 0 },
  updateTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reporterName: { flex: 1, color: '#314552', fontSize: 12, fontWeight: '800' },
  relativeTime: { color: '#8a969e', fontSize: 9, lineHeight: 13 },
  taskName: { color: '#4c606d', fontSize: 11, lineHeight: 16, marginTop: 2 },
  eventText: { color: '#73818b', fontSize: 9, lineHeight: 14, marginTop: 1 },
  reviewCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#f2dfb3',
  },
  reviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff0c9',
  },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewTitle: {
    color: '#5f4a22',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  reviewDetail: { color: '#806b44', fontSize: 10, lineHeight: 15 },
  notice: {
    color: '#315a70',
    backgroundColor: '#e8f1f5',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 2,
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
  emptyInline: {
    color: '#84919a',
    fontSize: 11,
    lineHeight: 17,
    paddingVertical: 13,
  },
  footer: { color: '#73818b', fontSize: 11, lineHeight: 18, marginTop: 18 },
});
