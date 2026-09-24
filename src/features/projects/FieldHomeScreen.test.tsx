import { render, screen } from '@testing-library/react-native';

import { FieldHomeScreen } from './FieldHomeScreen';
import { useMyWork } from './useMyWork';
import { useProjectRecentReports } from './useProjectRecentReports';

jest.mock('./useMyWork', () => ({ useMyWork: jest.fn() }));
jest.mock('./useProjectRecentReports', () => ({
  useProjectRecentReports: jest.fn(),
}));
jest.mock('./useProjectRecentReports.native', () => ({
  useProjectRecentReports: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => callback(),
  Link: ({ children }: { children: React.ReactNode }) => children,
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
  jest.mocked(useProjectRecentReports).mockReturnValue({
    items: [
      {
        captureId: 'capture',
        reportId: 'report',
        projectId: 'project',
        projectName: 'Site project',
        createdAt: '2026-09-24T01:00:00Z',
        kind: 'remote',
        summary: 'Installed two spools',
        mediaCount: 0,
        status: 'Awaiting review',
        detail: 'Submitted',
        canSync: false,
        canConfirm: false,
      },
    ],
    error: null,
    isPending: false,
    isFetching: false,
    refetch: jest.fn(),
  });
});

it('shows current assignments and recent report context for the selected project', async () => {
  await render(<FieldHomeScreen />);
  expect(screen.getByText('Site project')).toBeVisible();
  expect(screen.getByText('Line erection')).toBeVisible();
  expect(screen.getByText('Installed two spools')).toBeVisible();
  expect(screen.getByText('Awaiting review')).toBeVisible();
});

it('shows empty and offline states without inventing assignment counts', async () => {
  jest.mocked(useMyWork).mockReturnValue({
    project: { data: context, error: null, isPending: false },
    work: {
      data: {
        ...work,
        snapshot: { ...work.snapshot, activities: [] },
        assignments: [],
      },
      error: null,
    },
    refresh: jest.fn(),
    offline: true,
  } as unknown as ReturnType<typeof useMyWork>);
  jest.mocked(useProjectRecentReports).mockReturnValue({
    items: [],
    error: null,
    isPending: false,
    isFetching: false,
    refetch: jest.fn(),
  });
  await render(<FieldHomeScreen />);
  expect(screen.getByText('No assignment today.')).toBeVisible();
  expect(screen.getByText('No reports for this project yet.')).toBeVisible();
  expect(screen.getByText(/Offline · Showing project context/)).toBeVisible();
});
