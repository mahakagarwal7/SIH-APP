import Feather from '@expo/vector-icons/Feather';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
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

import {
  assignmentContext,
  hierarchyChildren,
  hierarchyNodeProgress,
  hierarchyPath,
} from './hierarchyModel';
import { useTaskHierarchy } from './useTaskHierarchy';

import type { HierarchyNode } from './hierarchyModel';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';

const chainColors = ['#f4aa20', '#2dbd70', '#7b5ce7', '#4485e3', '#f0a11e'];

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
  const formatter = new Intl.NumberFormat(getActiveLocaleTag(), {
    maximumSignificantDigits: 21,
  });
  const accepted = formatter.format(activity.acceptedQuantity);
  const unit = activity.unit ? ` ${activity.unit}` : ' (unit not recorded)';
  if (activity.targetQuantity === null)
    return `${accepted}${unit} accepted · Planned quantity not recorded`;
  return `${accepted} of ${formatter.format(activity.targetQuantity)}${unit} accepted`;
}

function levelLabel(node: HierarchyNode) {
  return (
    node.sourceLevel ||
    (node.kind === 'milestone'
      ? 'Milestone'
      : node.kind === 'task'
        ? 'Field task'
        : node.kind.replaceAll('_', ' '))
  );
}

function ChainNode({
  node,
  activities,
  index,
  selected,
  onPress,
}: {
  node: HierarchyNode;
  activities: ScheduleActivity[];
  index: number;
  selected: boolean;
  onPress(): void;
}) {
  const percent = hierarchyNodeProgress(node, activities);
  const accent = chainColors[index % chainColors.length]!;
  const value = percent === null ? '—' : `${percent}%`;
  return (
    <Pressable
      accessibilityLabel={`${node.externalId}. ${levelLabel(node)}. ${node.name}. ${percent === null ? 'Progress not recorded' : `${percent}% accepted progress`}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chainNode, selected && styles.chainNodeSelected]}
    >
      <View style={[styles.percentCircle, { borderColor: accent }]}>
        <Text style={[styles.percentValue, { color: accent }]}>{value}</Text>
      </View>
      <View style={styles.nodeCopy}>
        <Text style={[styles.levelLabel, { color: accent }]}>
          {levelLabel(node)}
        </Text>
        <Text numberOfLines={2} style={styles.nodeName}>
          {node.name}
        </Text>
        <Text numberOfLines={1} style={styles.nodeMeta}>
          {node.sourceWbs || node.externalId}
        </Text>
      </View>
    </Pressable>
  );
}

function HierarchyHeader() {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/field/work')
        }
        style={styles.headerAction}
      >
        <Feather color="#17354c" name="arrow-left" size={21} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.heading}>
        Task Hierarchy
      </Text>
      <Link href="/account" asChild>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          style={styles.headerAction}
        >
          <Feather color="#17354c" name="settings" size={20} />
        </Pressable>
      </Link>
    </View>
  );
}

function CurrentTaskCard({
  activity,
  userId,
}: {
  activity: ScheduleActivity;
  userId: string;
}) {
  return (
    <View style={styles.currentTask}>
      <View style={styles.currentIcon}>
        <Feather color="#ef9d16" name="target" size={20} />
      </View>
      <View style={styles.currentCopy}>
        <Text style={styles.currentLabel}>CURRENT TASK</Text>
        <Text style={styles.currentName}>{activity.name}</Text>
        <Text style={styles.currentMeta}>
          {activity.externalId} · {activity.location} ·{' '}
          {assignmentContext(activity, userId)}
        </Text>
        <Text style={styles.currentQuantity}>{quantityLabel(activity)}</Text>
        <Text style={styles.currentMeta}>
          Accepted actuals: {dateLabel(activity.actualStart)} –{' '}
          {dateLabel(activity.actualFinish)}
        </Text>
      </View>
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
  const [shareError, setShareError] = useState('');
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

  async function shareTask() {
    if (!data || !project.data) return;
    setShareError('');
    try {
      await Share.share({
        message: `${project.data.project.name}\n${data.activity.name} (${data.activity.externalId})\nAccepted progress: ${data.activity.acceptedPercent === null ? 'Not recorded' : `${data.activity.acceptedPercent}%`}`,
        title: 'Task hierarchy',
      });
    } catch {
      setShareError('Could not open sharing. Try again.');
    }
  }

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
      testID="task-hierarchy-scroll"
    >
      <View style={[shellStyles.content, styles.content]}>
        <HierarchyHeader />
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
            <Text accessibilityRole="alert" style={styles.stateTitle}>
              Hierarchy unavailable
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
              Select an active project or ask a manager to check your
              membership.
            </Text>
          </View>
        ) : !data || !graph || !focused || !branch ? (
          <View style={styles.state}>
            {!project.offline && <ActivityIndicator color="#7655d9" />}
            <Text style={shellStyles.body}>
              {project.offline
                ? 'No hierarchy has been loaded for this activity.'
                : 'Loading the current task hierarchy…'}
            </Text>
          </View>
        ) : (
          <>
            <CurrentTaskCard
              activity={data.activity}
              userId={project.data.member.user_id}
            />

            {(graph.limited || branch.missingParentId) && (
              <View style={styles.contextWarnings}>
                {graph.limited && (
                  <Text style={styles.notice}>
                    Showing the hierarchy path stored with this authorized
                    activity. Broader source branches are unavailable in this
                    snapshot.
                  </Text>
                )}
                {branch.missingParentId && (
                  <Text accessibilityRole="alert" style={styles.warning}>
                    Source parent {branch.missingParentId} is unavailable.
                    Showing the earliest visible branch.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.scheduleMeta}>
              <Text style={styles.scheduleLabel}>
                {data.snapshot.revisionLabel ?? 'Active schedule'}
              </Text>
              <Text style={styles.scheduleVersion}>
                Schedule v{data.snapshot.scheduleVersion} · Source relationships
              </Text>
            </View>

            <View style={styles.chain}>
              {branch.path.map((node, index) => (
                <View key={node.externalId}>
                  {index > 0 && (
                    <View style={styles.connector}>
                      <Feather color="#b7c1c8" name="arrow-down" size={16} />
                    </View>
                  )}
                  <ChainNode
                    activities={data.snapshot.activities}
                    index={index}
                    node={node}
                    onPress={() =>
                      setView({ key: viewKey, focusId: node.externalId })
                    }
                    selected={node.externalId === focusId}
                  />
                </View>
              ))}
            </View>

            {children.length ? (
              <View style={styles.children}>
                <Text style={styles.childrenLabel}>NEXT LEVEL</Text>
                {children.map((node, index) => (
                  <View key={node.externalId}>
                    <View style={styles.connector}>
                      <Feather color="#b7c1c8" name="arrow-down" size={16} />
                    </View>
                    <ChainNode
                      activities={data.snapshot.activities}
                      index={branch.path.length + index}
                      node={node}
                      onPress={() =>
                        setView({ key: viewKey, focusId: node.externalId })
                      }
                      selected={false}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.leaf}>
                No child branches in this snapshot.
              </Text>
            )}

            <Text style={styles.recordNote}>
              Percentages are accepted activity facts. A dash means the source
              snapshot records no accepted percentage for that level.
            </Text>

            {shareError && (
              <Text accessibilityRole="alert" style={styles.shareError}>
                {shareError}
              </Text>
            )}
            <View style={styles.actions}>
              <Link href="/field/report" asChild>
                <Pressable
                  accessibilityLabel="Speak progress for this task"
                  accessibilityRole="button"
                  style={[styles.circleAction, styles.micAction]}
                >
                  <Feather color="#ef5656" name="mic" size={21} />
                </Pressable>
              </Link>
              <Pressable
                accessibilityLabel="Share task hierarchy"
                accessibilityRole="button"
                onPress={() => void shareTask()}
                style={[styles.circleAction, styles.shareAction]}
              >
                <Feather color="#3d83e8" name="share" size={20} />
              </Pressable>
              <Link href="/field/report" asChild>
                <Pressable
                  accessibilityLabel="Update status with a field report"
                  accessibilityRole="button"
                  style={styles.updateAction}
                >
                  <Feather color="#ffffff" name="check" size={18} />
                  <Text style={styles.updateText}>UPDATE STATUS</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1e7eb',
  },
  heading: {
    color: '#17283a',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
  },
  currentTask: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5eaed',
    shadowColor: '#17354c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  currentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1d4',
  },
  currentCopy: { flex: 1, minWidth: 0 },
  currentLabel: {
    color: '#ef9d16',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  currentName: {
    color: '#263847',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 1,
  },
  currentMeta: { color: '#74838d', fontSize: 11, lineHeight: 17, marginTop: 2 },
  currentQuantity: {
    color: '#266b8c',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 5,
  },
  scheduleMeta: { alignItems: 'center', marginTop: 16, gap: 2 },
  scheduleLabel: {
    color: '#65747f',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  scheduleVersion: { color: '#909ba3', fontSize: 10, lineHeight: 15 },
  chain: { marginTop: 14 },
  chainNode: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chainNodeSelected: { borderColor: '#d8ccff', backgroundColor: '#fbf9ff' },
  percentCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  percentValue: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  nodeCopy: { flex: 1, minWidth: 0 },
  levelLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  nodeName: {
    color: '#314250',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  nodeMeta: { color: '#8a969e', fontSize: 10, lineHeight: 15 },
  connector: { height: 23, alignItems: 'center', justifyContent: 'center' },
  children: { marginTop: 2 },
  childrenLabel: {
    color: '#8a969e',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  leaf: {
    color: '#8a969e',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
  recordNote: {
    color: '#71808a',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  circleAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  micAction: { backgroundColor: '#fff0f0', borderColor: '#ffb7b7' },
  shareAction: { backgroundColor: '#edf4ff', borderColor: '#a9c8f5' },
  updateAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    backgroundColor: '#25bd64',
  },
  updateText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  contextWarnings: { marginTop: 10 },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    borderRadius: 12,
    padding: 13,
    marginVertical: 5,
    fontSize: 13,
    lineHeight: 20,
  },
  warning: {
    backgroundColor: '#fff2d9',
    color: '#76541d',
    borderRadius: 12,
    padding: 13,
    marginVertical: 5,
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
  shareError: {
    color: '#8a2e25',
    backgroundColor: '#fff0ed',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});
