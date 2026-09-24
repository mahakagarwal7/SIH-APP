import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { useProjectRecentReports } from './useProjectRecentReports.native';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/field-reports/myReportsService', () => ({
  getReportsClient: jest.fn(),
  loadRemoteReportsForProject: jest.fn(),
  mergeMyReports: jest.fn(() => []),
}));
jest.mock('@/features/field-reports/nativeDraftStore', () => ({
  getVoiceDraftStore: jest.fn(),
}));
jest.mock('@/features/field-reports/nativeOutbox', () => ({
  getNativeOutbox: jest.fn(),
}));
jest.mock('@/features/field-reports/nativeReportDraftStore', () => ({
  getReportDraftStore: jest.fn(),
}));

it('keeps Home loading until the enabled remote report query settles', async () => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'reporter' } },
    offline: false,
  } as never);
  jest
    .mocked(useQuery)
    .mockReturnValueOnce({
      data: { voice: [], reports: [], outbox: [] },
      error: null,
      isPending: false,
      isFetching: false,
      refetch: jest.fn(),
    } as never)
    .mockReturnValueOnce({
      data: undefined,
      error: null,
      isPending: true,
      isFetching: true,
      refetch: jest.fn(),
    } as never);

  const view = await renderHook(() => useProjectRecentReports('project'));

  expect(view.result.current.isPending).toBe(true);
});
