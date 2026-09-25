import {
  fieldHomeSummary,
  groupMyWork,
  presentWorkActivity,
  shiftSiteDate,
  siteToday,
} from './myWork';

import type { Assignment, WorkActivity } from './myWork';

const activity: WorkActivity = {
  id: 'task',
  projectId: 'project',
  revisionId: 'revision',
  externalId: 'PIP-1201',
  name: 'Line erection',
  discipline: 'Piping',
  location: 'Unit 2',
  assignedReporterId: 'reporter',
  targetQuantity: 8,
  unit: 'spools',
  acceptedQuantity: 2,
  actualStart: null,
  actualFinish: null,
  reportedProgress: true,
};
const assignment: Assignment = {
  project_id: 'project',
  activity_id: 'task',
  version: 1,
  reporter_id: 'reporter',
  effective_from: '2026-09-23',
  effective_to: '2026-09-23',
};

it('uses the latest assignment before grouping with inclusive date boundaries', () => {
  const activities = ['today', 'upcoming', 'earlier'].map((id) => ({
    ...activity,
    id,
  }));
  const assignments = [
    {
      ...assignment,
      activity_id: 'today',
      effective_from: '2026-09-22',
      version: 2,
    },
    {
      ...assignment,
      activity_id: 'today',
      effective_from: '2026-10-01',
      effective_to: '2026-10-02',
    },
    {
      ...assignment,
      activity_id: 'upcoming',
      effective_from: '2026-09-24',
      effective_to: '2026-09-25',
    },
    {
      ...assignment,
      activity_id: 'earlier',
      effective_from: '2026-09-21',
      effective_to: '2026-09-22',
    },
  ];
  const groups = groupMyWork(activities, assignments, 'reporter', '2026-09-23');
  expect(
    groups.map((g) => [g.title, g.items.map((i) => i.activity.id)]),
  ).toEqual([
    ['Today', ['today']],
    ['Up next', ['upcoming']],
    ['Earlier assignments', ['earlier']],
  ]);
  expect(groups[0]?.items[0]?.activity.acceptedQuantity).toBe(2);
  expect(groups[0]?.items[0]?.assignment.version).toBe(2);
});

it('uses latest assignment rows as the authority instead of a stale snapshot reporter field', () => {
  expect(
    groupMyWork(
      [{ ...activity, assignedReporterId: 'someone-else' }],
      [assignment],
      'reporter',
      '2026-09-23',
    )[0]?.items.map((item) => item.activity.id),
  ).toEqual(['task']);
});

it('omits work reassigned to another reporter and rejects orphan assignment rows', () => {
  expect(
    groupMyWork(
      [activity],
      [{ ...assignment, version: 2, reporter_id: 'someone-else' }],
      'reporter',
      '2026-09-23',
    ).every((group) => group.items.length === 0),
  ).toBe(true);
  expect(() =>
    groupMyWork([], [assignment], 'reporter', '2026-09-23'),
  ).toThrow();
});

it('uses India Standard Time at the UTC day boundary', () => {
  expect(siteToday(new Date('2026-09-23T18:29:59Z'))).toBe('2026-09-23');
  expect(siteToday(new Date('2026-09-23T18:30:00Z'))).toBe('2026-09-24');
});

it('steps date-only task navigation across month and year boundaries', () => {
  expect(shiftSiteDate('2026-01-01', -1)).toBe('2025-12-31');
  expect(shiftSiteDate('2026-01-31', 1)).toBe('2026-02-01');
});

it('presents only accepted progress and supported task states', () => {
  expect(presentWorkActivity(activity, '2026-09-25')).toEqual({
    percent: 0,
    status: 'START',
  });
  expect(
    presentWorkActivity(
      { ...activity, acceptedPercent: 45, actualStart: '2026-09-24' },
      '2026-09-25',
    ),
  ).toEqual({ percent: 45, status: 'WORKING' });
  expect(
    presentWorkActivity(
      { ...activity, acceptedPercent: 20, plannedFinish: '2026-09-24' },
      '2026-09-25',
    ),
  ).toEqual({ percent: 20, status: 'DELAYED' });
  expect(
    presentWorkActivity(
      { ...activity, acceptedPercent: 10, actualFinish: '2026-09-24' },
      '2026-09-25',
    ),
  ).toEqual({ percent: 100, status: 'DONE' });
});

it('summarizes accepted activity progress without treating quantities as completion', () => {
  expect(
    fieldHomeSummary(
      [
        {
          ...activity,
          acceptedQuantity: 8,
          acceptedPercent: 40,
          actualStart: '2026-09-20',
          actualFinish: null,
          plannedFinish: '2026-09-26',
        },
        {
          ...activity,
          id: 'complete',
          actualStart: '2026-09-20',
          actualFinish: '2026-09-24',
          plannedFinish: '2026-09-25',
        },
      ],
      '2026-09-25',
    ),
  ).toEqual({
    completed: 1,
    total: 2,
    percent: 70,
    timing: 'ON TIME',
  });
});

it('reports supported delay and unknown-timing states honestly', () => {
  expect(
    fieldHomeSummary(
      [{ ...activity, plannedFinish: '2026-09-24' }],
      '2026-09-25',
    ).timing,
  ).toBe('DELAYED');
  expect(fieldHomeSummary([activity], '2026-09-25').timing).toBe(
    'TIMING NOT RECORDED',
  );
  expect(fieldHomeSummary([], '2026-09-25')).toEqual({
    completed: 0,
    total: 0,
    percent: null,
    timing: 'TIMING NOT RECORDED',
  });
});
