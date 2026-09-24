import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NavLink, ShellPage, shellStyles } from '@/features/navigation/shellUi';

import {
  filterScheduleActivities,
  scheduleBar,
  scheduleDateRange,
  schedulePage,
  scheduleStatus,
} from './scheduleModel';
import { useManagerSchedule } from './useManagerSchedule';

import type { ScheduleActivity } from './scheduleContracts';
import type { Href } from 'expo-router';

function dateLabel(value: string | null) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function quantityLabel(activity: ScheduleActivity) {
  const accepted = new Intl.NumberFormat('en-IN').format(
    activity.acceptedQuantity,
  );
  if (activity.targetQuantity === null)
    return activity.nodeKind === 'milestone'
      ? 'Milestone · no quantity'
      : `${accepted} accepted · planned quantity not recorded`;
  return `${accepted} of ${new Intl.NumberFormat('en-IN').format(activity.targetQuantity)} ${activity.unit ?? 'unit not recorded'} accepted`;
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TimelineTrack({
  activity,
  range,
  baseline,
}: {
  activity: ScheduleActivity;
  range: { start: string; finish: string };
  baseline: boolean;
}) {
  const plan = scheduleBar(
    activity.plannedStart,
    activity.plannedFinish,
    range,
  );
  const base = scheduleBar(
    activity.baselineStart,
    activity.baselineFinish,
    range,
  );
  const actual = activity.actualStart
    ? scheduleBar(
        activity.actualStart,
        activity.actualFinish ?? activity.actualStart,
        range,
      )
    : null;
  return (
    <View
      accessibilityLabel={`Timeline. Planned ${dateLabel(activity.plannedStart)} to ${dateLabel(activity.plannedFinish)}.${baseline ? ` Baseline ${dateLabel(activity.baselineStart)} to ${dateLabel(activity.baselineFinish)}.` : ''}${activity.actualStart ? ` Accepted ${dateLabel(activity.actualStart)} to ${dateLabel(activity.actualFinish)}.` : ' Accepted start not recorded.'}`}
      style={styles.timeline}
    >
      {baseline && <View style={[styles.baselineBar, base]} />}
      <View
        style={[
          styles.planBar,
          plan,
          activity.nodeKind === 'milestone' && styles.milestoneBar,
        ]}
      />
      {actual && <View style={[styles.actualBar, actual]} />}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function ActivityCard({
  activity,
  range,
  baseline,
  expanded,
  onToggle,
}: {
  activity: ScheduleActivity;
  range: { start: string; finish: string };
  baseline: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = scheduleStatus(activity);
  return (
    <View style={shellStyles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardCopy}>
          <Text style={styles.identifier}>
            {activity.externalId} · {activity.discipline}
          </Text>
          <Text accessibilityRole="header" style={shellStyles.cardTitle}>
            {activity.name}
          </Text>
        </View>
        <Text
          style={[
            styles.badge,
            status === 'Complete' && styles.completeBadge,
            status.includes('unresolved') && styles.warningBadge,
          ]}
        >
          {status}
        </Text>
      </View>
      <Text style={styles.detail}>
        {activity.location} · {activity.stage}
      </Text>
      <TimelineTrack activity={activity} baseline={baseline} range={range} />
      <View style={styles.dateRow}>
        <Text style={styles.detail}>
          Planned {dateLabel(activity.plannedStart)} –{' '}
          {dateLabel(activity.plannedFinish)}
        </Text>
        <Text style={styles.detail}>
          Actual {dateLabel(activity.actualStart)} –{' '}
          {dateLabel(activity.actualFinish)}
        </Text>
      </View>
      <Text style={styles.quantity}>{quantityLabel(activity)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} schedule details for ${activity.externalId}`}
        onPress={onToggle}
        style={styles.detailsButton}
      >
        <Text style={shellStyles.linkText}>
          {expanded ? 'Hide activity record' : 'Activity record'}
        </Text>
      </Pressable>
      {expanded && (
        <View style={styles.record}>
          <DetailRow
            label="Source hierarchy"
            value={
              activity.hierarchyPath.map((part) => part.name).join(' / ') ||
              activity.location
            }
          />
          <DetailRow
            label="Source WBS / level"
            value={`${activity.sourceWbs ?? 'Not supplied'} · ${activity.sourceLevel ?? 'Task'}`}
          />
          <DetailRow label="Calendar" value={activity.calendar} />
          <DetailRow
            label="Predecessors"
            value={activity.predecessors || 'None stated'}
          />
          <DetailRow
            label="Original baseline"
            value={`${dateLabel(activity.baselineStart)} – ${dateLabel(activity.baselineFinish)}`}
          />
          <DetailRow
            label="Accepted actuals"
            value={`${dateLabel(activity.actualStart)} – ${dateLabel(activity.actualFinish)}`}
          />
          <DetailRow
            label="Accepted percentage"
            value={
              activity.acceptedPercent === null
                ? 'Not recorded'
                : `${activity.acceptedPercent}% · ${activity.percentBasis ?? 'basis not recorded'}`
            }
          />
          <DetailRow
            label="Progress as of"
            value={dateLabel(activity.progressAsOf)}
          />
          {activity.nodeKind === 'milestone' && (
            <DetailRow
              label="Milestone occurrence"
              value={dateLabel(activity.milestoneDate)}
            />
          )}
          {activity.reportedProgress && !activity.actualStart && (
            <Text style={styles.noticeInline}>
              Progress was reported, but the accepted start date remains
              unresolved.
            </Text>
          )}
          <Text style={styles.recordNote}>
            Physical quantity and reported percentage are separate from activity
            completion.
          </Text>
        </View>
      )}
      <NavLink
        href={`/task-hierarchy/${activity.id}` as Href}
        label="Open task hierarchy"
      />
    </View>
  );
}

export function ScheduleScreen() {
  const { project, schedule, refresh, authorized } = useManagerSchedule();
  const data = schedule.data;
  const viewKey = `${project.data?.project.id ?? ''}:${data?.revisionId ?? ''}:${data?.scheduleVersion ?? ''}`;
  const [view, setView] = useState({
    key: '',
    discipline: 'All',
    baseline: true,
    page: 0,
    expandedId: null as string | null,
  });
  const scoped =
    view.key === viewKey
      ? view
      : {
          key: viewKey,
          discipline: 'All',
          baseline: true,
          page: 0,
          expandedId: null,
        };
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const rows = useMemo(
    () => filterScheduleActivities(data?.activities ?? [], scoped.discipline),
    [data?.activities, scoped.discipline],
  );
  const visible = schedulePage(rows, scoped.page);
  const range = useMemo(
    () => scheduleDateRange(data?.activities ?? []),
    [data?.activities],
  );
  const disciplines = useMemo(
    () => [...new Set(data?.activities.map((row) => row.discipline) ?? [])],
    [data?.activities],
  );
  const busy = project.isFetching || schedule.isFetching;
  const error = project.error || schedule.error;

  return (
    <ShellPage title="Project schedule" eyebrow="MANAGER · ACCEPTED PLAN">
      <Text style={shellStyles.body}>
        Baseline and accepted field progress, in one read-only view.
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
            ? 'Offline · Showing the last loaded schedule. The active revision may have changed.'
            : 'Offline · Connect to load the accepted schedule.'}
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Schedule unavailable
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
            Ask an administrator to check your project membership.
          </Text>
        </View>
      ) : !authorized ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Manager access required
          </Text>
          <Text style={shellStyles.body}>
            Your selected project role cannot open the manager schedule.
          </Text>
        </View>
      ) : !data ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'No schedule has been loaded for this project.'
              : 'Loading the accepted schedule…'}
          </Text>
        </View>
      ) : data.revisionId === null ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>
            No active reporting schedule
          </Text>
          <Text style={shellStyles.body}>
            An initial schedule has not been activated for this project.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.revisionBanner}>
            <View style={styles.revisionCopy}>
              <Text style={styles.revisionLabel}>
                {data.revisionLabel ?? 'Active revision'}
              </Text>
              <Text style={styles.detail} selectable>
                Revision {data.revisionId}
              </Text>
            </View>
            <Text style={styles.version}>Schedule v{data.scheduleVersion}</Text>
          </View>
          <Text style={styles.acceptedNotice}>
            Pending reports do not change this accepted schedule.
          </Text>
          <View style={styles.controls}>
            <Text style={styles.controlLabel}>Discipline</Text>
            <View style={styles.choices}>
              {['All', ...disciplines].map((discipline) => (
                <Choice
                  key={discipline}
                  label={discipline === 'All' ? 'All disciplines' : discipline}
                  selected={scoped.discipline === discipline}
                  onPress={() =>
                    setView({
                      ...scoped,
                      discipline,
                      page: 0,
                      expandedId: null,
                    })
                  }
                />
              ))}
            </View>
            <Text style={styles.controlLabel}>Timeline</Text>
            <Choice
              label={scoped.baseline ? 'Baseline shown' : 'Baseline hidden'}
              selected={scoped.baseline}
              onPress={() => setView({ ...scoped, baseline: !scoped.baseline })}
            />
          </View>
          <View style={styles.legend}>
            {range && (
              <Text style={styles.detail}>
                {dateLabel(range.start)} – {dateLabel(range.finish)}
              </Text>
            )}
            <Text style={styles.detail}>━ Planned</Text>
            {scoped.baseline && <Text style={styles.detail}>— Baseline</Text>}
            <Text style={styles.detail}>━ Accepted actual</Text>
          </View>
          <Text style={styles.count}>
            {rows.length} {rows.length === 1 ? 'activity' : 'activities'}
          </Text>
          {range &&
            visible.rows.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                baseline={scoped.baseline}
                range={range}
                expanded={scoped.expandedId === activity.id}
                onToggle={() =>
                  setView({
                    ...scoped,
                    expandedId:
                      scoped.expandedId === activity.id ? null : activity.id,
                  })
                }
              />
            ))}
          {!rows.length && (
            <Text style={styles.empty}>
              No activities match this discipline in the active revision.
            </Text>
          )}
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: visible.page === 0 || busy }}
              disabled={visible.page === 0 || busy}
              onPress={() =>
                setView({
                  ...scoped,
                  page: visible.page - 1,
                  expandedId: null,
                })
              }
              style={[
                styles.pageButton,
                (visible.page === 0 || busy) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Previous activities</Text>
            </Pressable>
            <Text style={styles.detail}>
              {visible.total ? visible.from + 1 : 0}–
              {Math.min(visible.from + visible.rows.length, visible.total)} of{' '}
              {visible.total}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !visible.hasNext || busy }}
              disabled={!visible.hasNext || busy}
              onPress={() =>
                setView({
                  ...scoped,
                  page: visible.page + 1,
                  expandedId: null,
                })
              }
              style={[
                styles.pageButton,
                (!visible.hasNext || busy) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Next activities</Text>
            </Pressable>
          </View>
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
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginVertical: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  revisionBanner: {
    backgroundColor: '#17354c',
    padding: 16,
    marginTop: 14,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revisionCopy: { flex: 1, minWidth: 220, gap: 3 },
  revisionLabel: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  version: {
    color: '#17354c',
    backgroundColor: '#e5f1ea',
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 13,
  },
  acceptedNotice: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  controls: {
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
    gap: 10,
  },
  controlLabel: {
    color: '#17354c',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#a9b8c1',
    backgroundColor: '#fff',
  },
  choiceSelected: { backgroundColor: '#17354c', borderColor: '#17354c' },
  choiceText: { color: '#266b8c', fontSize: 14, fontWeight: '600' },
  choiceTextSelected: { color: '#fff' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  count: { color: '#17354c', fontSize: 16, lineHeight: 24, marginTop: 18 },
  cardHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardCopy: { flex: 1, minWidth: 190, gap: 4 },
  identifier: { color: '#627786', fontSize: 13, lineHeight: 20 },
  badge: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  completeBadge: { color: '#245c48', backgroundColor: '#e5f1ea' },
  warningBadge: { color: '#76541d', backgroundColor: '#fff2d9' },
  timeline: {
    height: 30,
    backgroundColor: '#f2f4f5',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 4,
  },
  baselineBar: {
    position: 'absolute',
    top: 5,
    height: 2,
    backgroundColor: '#8395a1',
  },
  planBar: {
    position: 'absolute',
    top: 11,
    height: 8,
    backgroundColor: '#266b8c',
  },
  milestoneBar: { minWidth: 6 },
  actualBar: {
    position: 'absolute',
    top: 23,
    height: 5,
    backgroundColor: '#3b8067',
  },
  dateRow: { gap: 2 },
  quantity: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '600',
  },
  detailsButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  record: { backgroundColor: '#f2f4f5', padding: 12, gap: 7 },
  detailRow: { gap: 1 },
  detailLabel: {
    color: '#627786',
    fontSize: 12,
    lineHeight: 19,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: { color: '#17354c', fontSize: 14, lineHeight: 22 },
  noticeInline: {
    color: '#76541d',
    backgroundColor: '#fff2d9',
    padding: 10,
    fontSize: 13,
    lineHeight: 21,
  },
  recordNote: { color: '#627786', fontSize: 13, lineHeight: 21, marginTop: 4 },
  empty: {
    color: '#627786',
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  pageButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
