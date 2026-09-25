import { act, render, screen } from '@testing-library/react-native';

import { FieldHomeScreen } from './FieldHomeScreen';
import { useMyWork } from './useMyWork';

jest.mock('./useMyWork', () => ({ useMyWork: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
  Link: jest.requireActual('expo-router/build/ui/Slot').Slot,
}));

const context = {
  member: {
    project_id: 'project',
    user_id: 'reporter',
    display_name: 'Field worker',
    role: 'reporter' as const,
    active: true,
    version: 4,
  },
  project: { id: 'project', name: 'Site project' },
};
const work = {
  snapshot: {
    projectId: 'project',
    projectName: 'Site project',
    revisionId: 'revision',
    activities: [
      {
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
        plannedFinish: '2099-01-01',
        actualStart: null,
        actualFinish: null,
        reportedProgress: false,
      },
    ],
  },
  assignments: [
    {
      project_id: 'project',
      activity_id: 'task',
      reporter_id: 'reporter',
      version: 1,
      effective_from: '2020-01-01',
      effective_to: '2099-01-01',
    },
  ],
};

beforeEach(() => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: { data: work, error: null },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
});

it('matches the field home summary and action layout', async () => {
  await render(<FieldHomeScreen />);
  expect(screen.getByText('Nirmaan')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open settings' })).toBeVisible();
  expect(screen.getByText('—')).toBeVisible();
  expect(screen.getByText('ACCEPTED PROGRESS')).toBeVisible();
  expect(screen.getByText('Site project')).toBeVisible();
  expect(screen.getByText('Unit 2')).toBeVisible();
  expect(screen.getByText('Line erection')).toBeVisible();
  expect(screen.getByText('ON TIME')).toBeVisible();
  for (const label of [
    'Speak Report',
    'Take Photo',
    'My Tasks',
    'View Progress',
  ])
    expect(screen.getByRole('button', { name: label })).toBeVisible();
});

it('computes the ring only from activities assigned to the signed-in reporter', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        snapshot: {
          ...work.snapshot,
          activities: [
            ...work.snapshot.activities,
            {
              ...work.snapshot.activities[0],
              id: 'other-task',
              assignedReporterId: 'another-reporter',
              actualStart: '2026-09-20',
              actualFinish: '2026-09-21',
              acceptedPercent: 100,
            },
          ],
        },
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
  await render(<FieldHomeScreen />);
  expect(screen.getByText('—')).toBeVisible();
  expect(screen.queryByText('50%')).toBeNull();
});

it('marks the project delayed only from a supported planned finish', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        snapshot: {
          ...work.snapshot,
          activities: [
            { ...work.snapshot.activities[0], plannedFinish: '2020-01-01' },
          ],
        },
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
  await render(<FieldHomeScreen />);
  expect(screen.getByText('DELAYED')).toBeVisible();
});

it('shows empty and offline states without inventing assignment counts', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        snapshot: {
          ...work.snapshot,
          activities: [
            { ...work.snapshot.activities[0], assignedReporterId: null },
          ],
        },
        assignments: [],
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: true,
  } as unknown as ReturnType<typeof useMyWork>);
  await render(<FieldHomeScreen />);
  expect(screen.getByText('No personal field assignments')).toBeVisible();
  expect(
    screen.getByText(
      'No activities are assigned to you in this project. Ask your supervisor to check your assignments.',
    ),
  ).toBeVisible();
  expect(screen.queryByText('ACCEPTED PROGRESS')).toBeNull();
  expect(screen.queryByText('0%')).toBeNull();
  expect(screen.getByText(/Offline · Showing project context/)).toBeVisible();
});

it('directs a planner without personal assignments to the project schedule', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: {
      data: { ...context, member: { ...context.member, role: 'planner' } },
      error: null,
      isPending: false,
    },
    work: {
      data: {
        ...work,
        snapshot: {
          ...work.snapshot,
          activities: [
            { ...work.snapshot.activities[0], assignedReporterId: null },
          ],
        },
        assignments: [],
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
  await render(<FieldHomeScreen />);
  expect(screen.getByText('No personal field assignments')).toBeVisible();
  expect(
    screen.getByText(
      'This is your personal task list. Open Manager Schedule to see all project activities.',
    ),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'View project schedule' }),
  ).toBeVisible();
});

it('shows the missing-schedule state without a personal progress ring', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        snapshot: { ...work.snapshot, revisionId: null, activities: [] },
        assignments: [],
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
  await render(<FieldHomeScreen />);
  expect(screen.getByText('No active schedule')).toBeVisible();
  expect(screen.queryByText('ACCEPTED PROGRESS')).toBeNull();
});

it('recomputes current assignments when the project day changes at midnight', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-23T18:29:00Z'));
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        assignments: [{ ...work.assignments[0], effective_from: '2026-09-24' }],
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: false,
  } as unknown as ReturnType<typeof useMyWork>);
  const view = await render(<FieldHomeScreen />);
  expect(screen.getByText('No assignment today.')).toBeVisible();

  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });

  expect(screen.getByText('Line erection')).toBeVisible();
  expect(screen.queryByText('No assignment today.')).toBeNull();
  await view.unmount();
  jest.useRealTimers();
});
