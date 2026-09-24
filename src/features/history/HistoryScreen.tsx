import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

import {
  defaultHistoryFilters,
  type ExecutionHistoryEntry,
  type HistoryEvidenceState,
  type HistoryFilters,
} from './historyContracts';
import {
  filterHistoryEntries,
  historyPage,
  type HistoryActivity,
} from './historyService';
import { useExecutionHistory } from './useExecutionHistory';

const emptyHistoryEntries: ExecutionHistoryEntry[] = [];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function acceptedLabel(value: string) {
  return `${new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))} IST`;
}

function eventKindLabel(value: string) {
  const label = value.replaceAll('_', ' ').toLocaleLowerCase();
  return `${label.charAt(0).toLocaleUpperCase()}${label.slice(1)}`;
}

function completedMatches(activity: HistoryActivity, filters: HistoryFilters) {
  const query = filters.search.trim().toLocaleLowerCase();
  return (
    !!activity.actualStart &&
    !!activity.actualFinish &&
    (filters.discipline === 'All' ||
      activity.discipline === filters.discipline) &&
    `${activity.externalId} ${activity.name} ${activity.location}`
      .toLocaleLowerCase()
      .includes(query)
  );
}

function elapsedLabel(activity: HistoryActivity) {
  if (activity.nodeKind === 'milestone') return 'Milestone occurrence';
  const days = Math.round(
    (Date.parse(activity.actualFinish!) - Date.parse(activity.actualStart!)) /
      86_400_000,
  );
  return `${days} calendar ${days === 1 ? 'day' : 'days'}`;
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

function CompletedCard({
  activity,
  selected,
  onSelect,
}: {
  activity: HistoryActivity;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter history to ${activity.externalId}`}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[styles.completedCard, selected && styles.completedSelected]}
    >
      <Text style={styles.identifier}>
        {activity.externalId} · {activity.discipline}
      </Text>
      <Text style={shellStyles.cardTitle}>{activity.name}</Text>
      <Text style={styles.detail}>{activity.location}</Text>
      <View style={styles.dateRow}>
        <Text style={styles.detail}>
          Start {dateLabel(activity.actualStart!)}
        </Text>
        <Text style={styles.detail}>
          Finish {dateLabel(activity.actualFinish!)}
        </Text>
      </View>
      <Text style={styles.elapsed}>{elapsedLabel(activity)}</Text>
    </Pressable>
  );
}

function HistoryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: ExecutionHistoryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={shellStyles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardHeadingCopy}>
          <Text style={styles.identifier}>
            {entry.externalId} · {entry.discipline}
          </Text>
          <Text accessibilityRole="header" style={shellStyles.cardTitle}>
            {entry.activityName}
          </Text>
        </View>
        <Text style={[styles.badge, !entry.effective && styles.replacedBadge]}>
          {entry.effective ? 'Current contribution' : 'Replaced by correction'}
        </Text>
      </View>
      <Text style={styles.detail}>
        {eventKindLabel(entry.eventKind)} · {dateLabel(entry.eventDate)} ·{' '}
        {entry.sourceId ?? 'Text report'}
      </Text>
      <Text style={styles.quote}>“{entry.quote}”</Text>
      <Text style={styles.detail}>{entry.location}</Text>
      <Text style={styles.detail}>
        Accepted by {entry.reviewer ?? 'Name not recorded'} ·{' '}
        {acceptedLabel(entry.acceptedAt)}
      </Text>
      <Text style={styles.reason}>Decision: {entry.reason}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} audit references for ${entry.externalId}`}
        onPress={onToggle}
        style={styles.detailsButton}
      >
        <Text style={shellStyles.linkText}>
          {expanded
            ? 'Hide audit details'
            : 'Audit references and accepted facts'}
        </Text>
      </Pressable>
      {expanded && (
        <View style={styles.audit}>
          <Text selectable style={styles.auditText}>
            Event {entry.eventId}
          </Text>
          <Text selectable style={styles.auditText}>
            Decision {entry.decisionId}
          </Text>
          <Text selectable style={styles.auditText}>
            Audit {entry.auditId ?? 'See decision record'}
          </Text>
          <Text selectable style={styles.auditText}>
            Plan revision {entry.revisionId}
          </Text>
          {entry.supersedesEventId && (
            <Text selectable style={styles.auditText}>
              Corrects event {entry.supersedesEventId}
            </Text>
          )}
          <Text style={styles.auditLabel}>Original report</Text>
          <Text selectable style={styles.auditSource}>
            {entry.source}
          </Text>
          <Text style={styles.auditLabel}>Accepted facts</Text>
          <Text selectable style={styles.facts}>
            {JSON.stringify(entry.facts, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

export function HistoryScreen() {
  const { project, history, refresh, authorized } = useExecutionHistory();
  const projectId = project.data?.project.id;
  const [view, setView] = useState<{
    projectId?: string;
    filters: HistoryFilters;
    page: number;
    expandedEventId: string | null;
  }>({ filters: defaultHistoryFilters, page: 0, expandedEventId: null });
  const scoped =
    view.projectId === projectId
      ? view
      : {
          projectId,
          filters: defaultHistoryFilters,
          page: 0,
          expandedEventId: null,
        };
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const data = history.data;
  const entries = data?.entries ?? emptyHistoryEntries;
  const filteredEntries = useMemo(
    () => filterHistoryEntries(entries, scoped.filters),
    [entries, scoped.filters],
  );
  const visible = historyPage(filteredEntries, scoped.page);
  const completed = useMemo(
    () =>
      (data?.snapshot.activities ?? []).filter((activity) =>
        completedMatches(activity, scoped.filters),
      ),
    [data?.snapshot.activities, scoped.filters],
  );
  const disciplines = useMemo(
    () =>
      [
        ...new Set([
          ...entries.map((entry) => entry.discipline),
          ...(data?.snapshot.activities.map(
            (activity) => activity.discipline,
          ) ?? []),
        ]),
      ].sort(),
    [data?.snapshot.activities, entries],
  );
  const busy = project.isFetching || history.isFetching;
  const error = project.error || history.error;

  const updateFilters = (next: Partial<HistoryFilters>) =>
    setView({
      ...scoped,
      filters: { ...scoped.filters, ...next },
      page: 0,
      expandedEventId: null,
    });

  return (
    <ShellPage title="Execution history" eyebrow="MANAGER · ACCEPTED RECORD">
      <Text style={shellStyles.body}>
        A queryable record of what happened, with supporting evidence.
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
            ? 'Offline · Showing previously loaded history. Accepted records may have changed.'
            : 'Offline · Connect to load execution history.'}
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Execution history unavailable
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
            Your selected project role cannot read accepted execution history.
          </Text>
        </View>
      ) : !data ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'No history has been loaded for this project.'
              : 'Loading accepted records…'}
          </Text>
        </View>
      ) : (
        <HistoryContent
          busy={busy}
          completed={completed}
          disciplines={disciplines}
          entries={filteredEntries}
          page={visible}
          projectId={projectId}
          scoped={scoped}
          setView={setView}
          updateFilters={updateFilters}
        />
      )}
    </ShellPage>
  );
}

type ScopedView = {
  projectId?: string;
  filters: HistoryFilters;
  page: number;
  expandedEventId: string | null;
};

function HistoryContent({
  busy,
  completed,
  disciplines,
  entries,
  page,
  projectId,
  scoped,
  setView,
  updateFilters,
}: {
  busy: boolean;
  completed: HistoryActivity[];
  disciplines: string[];
  entries: ExecutionHistoryEntry[];
  page: ReturnType<typeof historyPage<ExecutionHistoryEntry>>;
  projectId?: string;
  scoped: ScopedView;
  setView: (value: ScopedView) => void;
  updateFilters: (next: Partial<HistoryFilters>) => void;
}) {
  return (
    <>
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Find accepted work</Text>
        <TextInput
          accessibilityLabel="Find accepted work"
          maxLength={160}
          onChangeText={(search) => updateFilters({ search })}
          placeholder="Activity ID, source ID, area or wording"
          placeholderTextColor="#758896"
          style={styles.search}
          value={scoped.filters.search}
        />
        <Text style={styles.filterLabel}>Discipline</Text>
        <View style={styles.choices}>
          {['All', ...disciplines].map((discipline) => (
            <Choice
              key={discipline}
              label={discipline}
              selected={scoped.filters.discipline === discipline}
              onPress={() => updateFilters({ discipline })}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setView({
              projectId,
              filters: defaultHistoryFilters,
              page: 0,
              expandedEventId: null,
            })
          }
          style={styles.clearButton}
        >
          <Text style={shellStyles.linkText}>Clear history filters</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Completed work
        </Text>
        <Text style={styles.countBadge}>
          {completed.length}{' '}
          {completed.length === 1 ? 'activity' : 'activities'}
        </Text>
      </View>
      {completed.map((activity) => (
        <CompletedCard
          key={activity.id}
          activity={activity}
          selected={scoped.filters.activityId === activity.id}
          onSelect={() =>
            updateFilters({
              activityId:
                scoped.filters.activityId === activity.id ? '' : activity.id,
            })
          }
        />
      ))}
      {!completed.length && (
        <Text style={styles.empty}>
          No completed activities match these work filters. Source IDs and field
          wording can still match accepted records below.
        </Text>
      )}
      <Text style={styles.caution}>
        Date spans are not working durations or productivity. Valid calendars,
        shifts and a clear quantity basis are required for those comparisons.
      </Text>

      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Accepted field records
        </Text>
        <Text style={styles.countBadge}>
          {entries.length} {entries.length === 1 ? 'event' : 'events'}
        </Text>
      </View>
      <Text style={styles.filterLabel}>Evidence status</Text>
      <View style={styles.choices}>
        {(
          [
            ['all', 'All accepted'],
            ['effective', 'Current'],
            ['superseded', 'Replaced'],
          ] as [HistoryEvidenceState, string][]
        ).map(([state, label]) => (
          <Choice
            key={state}
            label={label}
            selected={scoped.filters.state === state}
            onPress={() => updateFilters({ state })}
          />
        ))}
      </View>
      {scoped.filters.activityId && (
        <View style={styles.selectedActivity}>
          <Text style={styles.detail}>Showing one selected activity.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => updateFilters({ activityId: '' })}
            style={styles.inlineButton}
          >
            <Text style={shellStyles.linkText}>Show all activities</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.caution}>
        Field wording is linked to the reviewed activity. It is evidence, not
        automatically approved vocabulary for future reports.
      </Text>
      {page.rows.map((entry) => (
        <HistoryCard
          key={entry.eventId}
          entry={entry}
          expanded={scoped.expandedEventId === entry.eventId}
          onToggle={() =>
            setView({
              ...scoped,
              expandedEventId:
                scoped.expandedEventId === entry.eventId ? null : entry.eventId,
            })
          }
        />
      ))}
      {!entries.length && (
        <Text style={styles.empty}>
          No accepted events match. Pending reports remain in the review queue.
        </Text>
      )}
      <View style={styles.pagination}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: page.page === 0 || busy }}
          disabled={page.page === 0 || busy}
          onPress={() =>
            setView({ ...scoped, page: page.page - 1, expandedEventId: null })
          }
          style={[
            styles.pageButton,
            (page.page === 0 || busy) && styles.disabled,
          ]}
        >
          <Text style={shellStyles.linkText}>Previous records</Text>
        </Pressable>
        <Text style={styles.detail}>
          {page.total ? page.from + 1 : 0}–
          {Math.min(page.from + page.rows.length, page.total)} of {page.total}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !page.hasNext || busy }}
          disabled={!page.hasNext || busy}
          onPress={() =>
            setView({ ...scoped, page: page.page + 1, expandedEventId: null })
          }
          style={[
            styles.pageButton,
            (!page.hasNext || busy) && styles.disabled,
          ]}
        >
          <Text style={shellStyles.linkText}>Next records</Text>
        </Pressable>
      </View>
    </>
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
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginVertical: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  filters: {
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },
  filterLabel: {
    color: '#17354c',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 4,
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#a9b8c1',
    backgroundColor: '#fff',
    color: '#17354c',
    fontSize: 16,
    paddingHorizontal: 12,
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
  clearButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 23,
    lineHeight: 32,
    fontWeight: '700',
  },
  countBadge: {
    color: '#245c48',
    backgroundColor: '#e5f1ea',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 13,
  },
  completedCard: {
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
    gap: 5,
  },
  completedSelected: { borderColor: '#266b8c', borderWidth: 2 },
  identifier: { color: '#627786', fontSize: 13, lineHeight: 20 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  elapsed: {
    color: '#17354c',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
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
  caution: { color: '#627786', fontSize: 14, lineHeight: 22, marginTop: 14 },
  cardHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardHeadingCopy: { flex: 1, minWidth: 180, gap: 4 },
  badge: {
    color: '#245c48',
    backgroundColor: '#e5f1ea',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  replacedBadge: { color: '#76541d', backgroundColor: '#fff2d9' },
  quote: {
    color: '#17354c',
    borderLeftColor: '#266b8c',
    borderLeftWidth: 3,
    paddingLeft: 12,
    fontSize: 16,
    lineHeight: 25,
  },
  reason: { color: '#17354c', fontSize: 15, lineHeight: 24 },
  detailsButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  audit: { backgroundColor: '#f2f4f5', padding: 12, gap: 4 },
  auditText: { color: '#465e6d', fontSize: 12, lineHeight: 19 },
  auditLabel: {
    color: '#17354c',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  auditSource: { color: '#465e6d', fontSize: 14, lineHeight: 22 },
  facts: {
    color: '#17354c',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  selectedActivity: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  inlineButton: { minHeight: 44, justifyContent: 'center' },
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
