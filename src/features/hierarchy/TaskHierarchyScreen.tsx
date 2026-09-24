import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
} from '@/features/localization/LocalizedText';
import {
  getActiveLocaleTag,
  useLocalization,
} from '@/features/localization/LocalizationProvider';

import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';
import { scheduleStatus } from '@/features/schedule/scheduleModel';

import {
  assignmentContext,
  hierarchyChildren,
  hierarchyPath,
} from './hierarchyModel';
import { useTaskHierarchy } from './useTaskHierarchy';

import type { HierarchyNode } from './hierarchyModel';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';

function dateLabel(value: string | null) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function quantityLabel(activity: ScheduleActivity) {
  const accepted = new Intl.NumberFormat(getActiveLocaleTag()).format(
    activity.acceptedQuantity,
  );
  if (activity.targetQuantity === null)
    return `${accepted}${activity.unit ? ` ${activity.unit}` : ''} accepted · Planned quantity not recorded`;
  return `${accepted} of ${new Intl.NumberFormat(getActiveLocaleTag()).format(activity.targetQuantity)} ${activity.unit ?? 'unit not recorded'} accepted`;
}

function nodeDetail(node: HierarchyNode) {
  return [node.sourceWbs, node.sourceLevel, node.kind.replaceAll('_', ' ')]
    .filter(Boolean)
    .join(' · ');
}

function NodeButton({
  node,
  selected,
  onPress,
}: {
  node: HierarchyNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.node, selected && styles.selectedNode]}
    >
      <Text style={styles.nodeId}>{node.externalId}</Text>
      <Text style={styles.nodeTitle}>{node.name}</Text>
      <Text style={styles.detail}>
        {nodeDetail(node) || 'Source hierarchy context'}
      </Text>
      <Text style={styles.detail}>
        Planned {dateLabel(node.plannedStart)} – {dateLabel(node.plannedFinish)}
      </Text>
    </Pressable>
  );
}

function ActivityFacts({
  activity,
  userId,
}: {
  activity: ScheduleActivity;
  userId: string;
}) {
  return (
    <View style={shellStyles.card}>
      <Text style={styles.badge}>{scheduleStatus(activity)}</Text>
      <Text style={styles.nodeId}>
        {activity.externalId} · {activity.discipline}
      </Text>
      <Text accessibilityRole="header" style={shellStyles.cardTitle}>
        {activity.name}
      </Text>
      <Text style={styles.detail}>
        {activity.location} · {activity.stage}
      </Text>
      <Text style={styles.assignment}>
        {assignmentContext(activity, userId)}
      </Text>
      <Text style={styles.quantity}>{quantityLabel(activity)}</Text>
      <Text style={styles.detail}>
        Accepted actuals: {dateLabel(activity.actualStart)} –{' '}
        {dateLabel(activity.actualFinish)}
      </Text>
      <Text style={styles.detail}>
        Accepted progress:{' '}
        {activity.acceptedPercent === null
          ? 'Not recorded'
          : `${activity.acceptedPercent}% · ${activity.percentBasis ?? 'basis not recorded'}`}
      </Text>
      <Text style={styles.detail}>
        Progress as of: {dateLabel(activity.progressAsOf)}
      </Text>
      {activity.nodeKind === 'milestone' && (
        <Text style={styles.detail}>
          Milestone occurrence: {dateLabel(activity.milestoneDate)}
        </Text>
      )}
      <Text style={styles.recordNote}>
        Quantities, percentage and actual dates are accepted activity facts.
        Parent nodes do not receive calculated progress here.
      </Text>
    </View>
  );
}

export function TaskHierarchyScreen({ activityId }: { activityId: string }) {
  useLocalization();
  const { project, hierarchy, refresh } = useTaskHierarchy(activityId);
  const data = hierarchy.data;
  const graph = data?.hierarchy;
  const viewKey = `${project.data?.project.id ?? ''}:${data?.snapshot.revisionId ?? ''}:${data?.snapshot.scheduleVersion ?? ''}:${activityId}`;
  const [view, setView] = useState({ key: '', focusId: '' });
  const focusId =
    view.key === viewKey &&
    graph?.nodes.some((node) => node.externalId === view.focusId)
      ? view.focusId
      : (graph?.selectedExternalId ?? '');
  const focused = graph?.nodes.find((node) => node.externalId === focusId);
  const branch = graph && focusId ? hierarchyPath(graph.nodes, focusId) : null;
  const children =
    graph && focusId ? hierarchyChildren(graph.nodes, focusId) : [];
  const busy = project.isFetching || hierarchy.isFetching;
  const error = project.error || hierarchy.error;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ShellPage title="Task hierarchy" eyebrow="PROJECT · READ-ONLY CONTEXT">
      <BackButton />
      <Text style={shellStyles.body}>
        Follow the source schedule branch around this activity.
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
            ? 'Offline · Showing the last loaded hierarchy. The active revision may have changed.'
            : 'Offline · Connect to load this task hierarchy.'}
        </Text>
      )}
      {!activityId ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          This activity is no longer available.
        </Text>
      ) : error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Hierarchy unavailable
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
            Select an active project or ask a manager to check your membership.
          </Text>
        </View>
      ) : !data || !graph || !focused || !branch ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'No hierarchy has been loaded for this activity.'
              : 'Loading the current task hierarchy…'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.revision}>
            <Text style={styles.revisionTitle}>
              {data.snapshot.revisionLabel ?? 'Active schedule'}
            </Text>
            <Text style={styles.detail}>
              Schedule v{data.snapshot.scheduleVersion} · Source relationships
            </Text>
          </View>
          {graph.limited && (
            <Text style={styles.notice}>
              Showing the hierarchy path stored with this authorized activity.
              Broader source branches are unavailable in this snapshot.
            </Text>
          )}
          {branch.missingParentId && (
            <Text accessibilityRole="alert" style={styles.warning}>
              Source parent {branch.missingParentId} is unavailable. Showing the
              earliest visible branch.
            </Text>
          )}

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Current path
          </Text>
          <View style={styles.path}>
            {branch.path.map((node, index) => (
              <View key={node.externalId}>
                {index > 0 && <View style={styles.connector} />}
                <NodeButton
                  node={node}
                  selected={node.externalId === focusId}
                  onPress={() =>
                    setView({ key: viewKey, focusId: node.externalId })
                  }
                />
              </View>
            ))}
          </View>

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Direct child branches
          </Text>
          {children.length ? (
            children.map((node) => (
              <NodeButton
                key={node.externalId}
                node={node}
                selected={false}
                onPress={() =>
                  setView({ key: viewKey, focusId: node.externalId })
                }
              />
            ))
          ) : (
            <Text style={styles.empty}>
              No child branches in this snapshot.
            </Text>
          )}

          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Selected activity facts
          </Text>
          <ActivityFacts
            activity={data.activity}
            userId={project.data.member.user_id}
          />
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
    marginVertical: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  revision: {
    borderTopColor: '#d7e0e5',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
    gap: 3,
  },
  revisionTitle: { color: '#17354c', fontSize: 17, fontWeight: '600' },
  sectionTitle: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
    marginTop: 28,
    marginBottom: 4,
  },
  path: { marginTop: 8 },
  connector: {
    width: 2,
    height: 14,
    marginLeft: 18,
    backgroundColor: '#b8c8d1',
  },
  node: {
    minHeight: 48,
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    gap: 3,
  },
  selectedNode: { borderColor: '#266b8c', borderLeftWidth: 4 },
  nodeId: {
    color: '#627786',
    fontSize: 13,
    lineHeight: 21,
    letterSpacing: 0.4,
  },
  nodeTitle: {
    color: '#17354c',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
  },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  empty: {
    color: '#627786',
    backgroundColor: '#fff',
    borderColor: '#d7e0e5',
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
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
  assignment: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
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
  recordNote: { color: '#627786', fontSize: 13, lineHeight: 21, marginTop: 4 },
});
