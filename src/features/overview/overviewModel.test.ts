import {
  acceptedEventDays,
  acceptedEventWeeks,
  attentionReason,
  disciplineProgress,
  overviewSummary,
  recentAcceptedEvents,
  relativeAcceptedTime,
  verifiedReporterLabel,
} from './overviewModel';

import type { ExecutionHistoryEntry } from '@/features/history/historyContracts';
import type { ScheduleActivity } from '@/features/schedule/scheduleContracts';

const activity = {
  discipline: 'Piping',
  actualStart: '2026-09-20',
  actualFinish: null,
  acceptedPercent: 40,
} as ScheduleActivity;

const event = {
  eventId: 'event-1',
  eventDate: '2026-09-22',
  acceptedAt: '2026-09-22T10:00:00+00:00',
  effective: true,
} as ExecutionHistoryEntry;

it('aggregates accepted activity percentages without inferring from quantities', () => {
  const activities: ScheduleActivity[] = [
    activity,
    { ...activity, actualFinish: '2026-09-23' },
    { ...activity, discipline: 'Civil', actualStart: null, acceptedPercent: 0 },
    {
      ...activity,
      discipline: 'Civil',
      actualStart: null,
      acceptedPercent: 20,
      reportedProgress: true,
    },
  ];
  expect(overviewSummary(activities, 7)).toEqual({
    planned: 4,
    completed: 1,
    completionPercent: 40,
    inProgress: 1,
    unresolvedProgress: 1,
    actionableClaims: 7,
  });
  expect(overviewSummary([], 0).completionPercent).toBeNull();
  expect(disciplineProgress(activities)).toEqual([
    {
      discipline: 'Civil',
      planned: 2,
      completed: 0,
      inProgress: 0,
      percent: 10,
    },
    {
      discipline: 'Piping',
      planned: 2,
      completed: 1,
      inProgress: 1,
      percent: 70,
    },
  ]);
});

it('groups only effective accepted events into the current site week by day', () => {
  const days = acceptedEventDays(
    [
      event,
      { ...event, eventId: 'event-2', eventDate: '2026-09-22' },
      { ...event, eventId: 'event-3', eventDate: '2026-09-24' },
      {
        ...event,
        eventId: 'event-replaced',
        eventDate: '2026-09-22',
        effective: false,
      },
      { ...event, eventId: 'event-old', eventDate: '2026-09-20' },
      { ...event, eventId: 'event-future', eventDate: '2026-09-28' },
    ] as ExecutionHistoryEntry[],
    '2026-09-24',
  );

  expect(days).toEqual([
    { date: '2026-09-21', day: 'M', count: 0 },
    { date: '2026-09-22', day: 'T', count: 2 },
    { date: '2026-09-23', day: 'W', count: 0 },
    { date: '2026-09-24', day: 'T', count: 1 },
    { date: '2026-09-25', day: 'F', count: 0 },
    { date: '2026-09-26', day: 'S', count: 0 },
    { date: '2026-09-27', day: 'S', count: 0 },
  ]);
});

it('groups only effective accepted events into six Monday-to-Sunday work weeks', () => {
  const weeks = acceptedEventWeeks(
    [
      event,
      { ...event, eventId: 'event-2', eventDate: '2026-09-23' },
      { ...event, eventId: 'event-3', eventDate: '2026-09-14' },
      {
        ...event,
        eventId: 'event-4',
        eventDate: '2026-09-22',
        effective: false,
      },
      { ...event, eventId: 'event-future', eventDate: '2026-10-05' },
    ] as ExecutionHistoryEntry[],
    '2026-09-24',
  );
  expect(weeks).toHaveLength(6);
  expect(weeks.at(-2)).toEqual({
    start: '2026-09-14',
    end: '2026-09-20',
    count: 1,
  });
  expect(weeks.at(-1)).toEqual({
    start: '2026-09-21',
    end: '2026-09-27',
    count: 2,
  });
  expect(weeks.reduce((sum, week) => sum + week.count, 0)).toBe(3);
});

it('returns newest current evidence and excludes records replaced by corrections', () => {
  const result = recentAcceptedEvents([
    event,
    {
      ...event,
      eventId: 'event-2',
      acceptedAt: '2026-09-23T10:00:00+00:00',
    },
    {
      ...event,
      eventId: 'event-replaced',
      acceptedAt: '2026-09-24T10:00:00+00:00',
      effective: false,
    },
  ] as ExecutionHistoryEntry[]);
  expect(result.map((item) => item.eventId)).toEqual(['event-2', 'event-1']);
});

it('labels verified updates with recorded reporters and stable relative time', () => {
  expect(
    verifiedReporterLabel({
      ...event,
      provenance: { reportedByLabel: 'Site supervisor' },
    } as ExecutionHistoryEntry),
  ).toBe('Site supervisor');
  expect(
    verifiedReporterLabel({
      ...event,
      provenance: { reportedByLabel: null },
    } as ExecutionHistoryEntry),
  ).toBe('Reporter not recorded');
  expect(
    relativeAcceptedTime(
      '2026-09-25T09:29:20.000Z',
      Date.parse('2026-09-25T09:30:00.000Z'),
    ),
  ).toBe('Just now');
  expect(
    relativeAcceptedTime(
      '2026-09-25T08:00:00.000Z',
      Date.parse('2026-09-25T09:30:00.000Z'),
    ),
  ).toBe('1 hour ago');
  expect(
    relativeAcceptedTime(
      '2026-09-22T09:30:00.000Z',
      Date.parse('2026-09-25T09:30:00.000Z'),
    ),
  ).toBe('3 days ago');
});

it('uses the existing review state and flags as the attention reason', () => {
  expect(
    attentionReason({
      state: 'verification',
      manual_review: false,
      validation_flags: [],
    }),
  ).toBe('Supervisor check pending');
  expect(
    attentionReason({
      state: 'pending',
      manual_review: false,
      validation_flags: ['Start date missing'],
    }),
  ).toBe('Start date missing');
  expect(
    attentionReason({
      state: 'pending',
      manual_review: true,
      validation_flags: [],
    }),
  ).toBe('Planner follow-up needed');
});
