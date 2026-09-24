import type {
  ManagerSchedule,
  ScheduleActivity,
} from '@/features/schedule/scheduleContracts';

export type HierarchyNode = {
  externalId: string;
  parentId: string | null;
  name: string;
  kind: 'summary' | 'task' | 'milestone' | 'external_dependency';
  sourceLevel: string | null;
  sourceWbs: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  reportable: boolean;
  activityId: string | null;
};

export type HierarchyGraph = {
  nodes: HierarchyNode[];
  selectedExternalId: string;
  limited: boolean;
};

export class HierarchyGraphError extends Error {}

function sortNodes(a: HierarchyNode, b: HierarchyNode) {
  return (
    (a.sourceWbs ?? '').localeCompare(b.sourceWbs ?? '', undefined, {
      numeric: true,
    }) || a.externalId.localeCompare(b.externalId)
  );
}

export function buildHierarchyGraph(
  snapshot: ManagerSchedule,
  selected: ScheduleActivity,
): HierarchyGraph {
  const activityIds = new Map(
    snapshot.activities.map((activity) => [activity.externalId, activity.id]),
  );
  let limited = false;
  let nodes: HierarchyNode[];
  if (snapshot.nodes.some((node) => node.externalId === selected.externalId)) {
    nodes = snapshot.nodes.map((node) => ({
      ...node,
      sourceLevel: node.sourceLevel || null,
      sourceWbs: node.sourceWbs || null,
      activityId: activityIds.get(node.externalId) ?? null,
    }));
  } else {
    limited = true;
    const ancestors = selected.hierarchyPath.filter(
      (part, index, path) =>
        part.id !== selected.externalId &&
        path.findIndex((candidate) => candidate.id === part.id) === index,
    );
    nodes = ancestors.map((part, index) => ({
      externalId: part.id,
      parentId: index ? ancestors[index - 1]!.id : null,
      name: part.name,
      kind: 'summary',
      sourceLevel: null,
      sourceWbs: null,
      plannedStart: null,
      plannedFinish: null,
      reportable: false,
      activityId: null,
    }));
    nodes.push({
      externalId: selected.externalId,
      parentId: ancestors.at(-1)?.id ?? null,
      name: selected.name,
      kind: selected.nodeKind,
      sourceLevel: selected.sourceLevel,
      sourceWbs: selected.sourceWbs,
      plannedStart: selected.plannedStart,
      plannedFinish: selected.plannedFinish,
      reportable: true,
      activityId: selected.id,
    });
  }

  const ids = new Set(nodes.map((node) => node.externalId));
  if (ids.size !== nodes.length) throw new HierarchyGraphError('duplicate');
  for (const node of nodes) hierarchyPath(nodes, node.externalId);
  return {
    nodes: nodes.slice().sort(sortNodes),
    selectedExternalId: selected.externalId,
    limited,
  };
}

export function hierarchyPath(nodes: HierarchyNode[], externalId: string) {
  const byId = new Map(nodes.map((node) => [node.externalId, node]));
  const path: HierarchyNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(externalId);
  let missingParentId: string | null = null;
  if (!current) throw new HierarchyGraphError('missing-node');
  while (current) {
    if (visited.has(current.externalId)) throw new HierarchyGraphError('cycle');
    visited.add(current.externalId);
    path.unshift(current);
    if (!current.parentId) break;
    const parent = byId.get(current.parentId);
    if (!parent) {
      missingParentId = current.parentId;
      break;
    }
    current = parent;
  }
  return { path, missingParentId };
}

export function hierarchyChildren(nodes: HierarchyNode[], parentId: string) {
  return nodes.filter((node) => node.parentId === parentId).sort(sortNodes);
}

export function assignmentContext(activity: ScheduleActivity, userId: string) {
  return activity.assignedReporterId === null
    ? 'No reporter assigned'
    : activity.assignedReporterId === userId
      ? 'Assigned to you'
      : 'Assigned to another authorized reporter';
}
