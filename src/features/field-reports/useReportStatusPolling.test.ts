import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import { AppState } from 'react-native';

import { useReportStatusPolling } from './useReportStatusPolling';

import type { RemoteReport } from './myReportsService';
import type { AppStateStatus } from 'react-native';

const processing = {
  id: '40000000-0000-4000-8000-000000000004',
  project_id: '30000000-0000-4000-8000-000000000003',
  author_id: '20000000-0000-4000-8000-000000000002',
  capture_id: '10000000-0000-4000-8000-000000000001',
  current_version: 1,
  lifecycle: 'submitted',
  received_at: '2026-09-24T00:00:00Z',
  source_kind: 'text',
  claims: [],
  jobs: [
    {
      id: '50000000-0000-4000-8000-000000000005',
      report_id: '40000000-0000-4000-8000-000000000004',
      report_version: 1,
      status: 'running',
      attempts: 1,
      error_code: null,
      claim_count: null,
      created_at: '2026-09-24T00:00:01Z',
    },
  ],
} as RemoteReport;
const accepted = {
  ...processing,
  jobs: [
    {
      ...processing.jobs[0],
      status: 'succeeded',
    },
  ],
  claims: [
    {
      report_id: processing.id,
      report_version: processing.current_version,
      state: 'accepted',
    },
  ],
} as RemoteReport;
const originalState = AppState.currentState;

beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
});

afterEach(() => {
  AppState.currentState = originalState;
  jest.useRealTimers();
});

it('backs off while processing and stops after a terminal outcome', async () => {
  const refetch = jest
    .fn()
    .mockResolvedValueOnce({ data: [processing] })
    .mockResolvedValueOnce({ data: [accepted] });
  await renderHook(() =>
    useReportStatusPolling({ enabled: true, focused: true, refetch }),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });
  expect(refetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(9_999);
  });
  expect(refetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(refetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(refetch).toHaveBeenCalledTimes(2);
});

it('pauses while inactive and starts a fresh foreground check on resume', async () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, next) => {
    listener = next;
    return { remove };
  });
  AppState.currentState = 'background';
  const refetch = jest.fn().mockResolvedValue({ data: [processing] });
  const view = await renderHook(() =>
    useReportStatusPolling({ enabled: true, focused: true, refetch }),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(refetch).not.toHaveBeenCalled();
  await act(async () => listener?.('active'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });
  expect(refetch).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('does not schedule network work while disabled', async () => {
  const refetch = jest.fn();
  await renderHook(() =>
    useReportStatusPolling({ enabled: false, focused: true, refetch }),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(refetch).not.toHaveBeenCalled();
});

it('stops scheduling status polls when the screen loses focus', async () => {
  const refetch = jest.fn().mockResolvedValue({ data: [processing] });
  const view = await renderHook(() => {
    const [focused, setFocused] = useState(true);
    useReportStatusPolling({ enabled: true, focused, refetch });
    return { blur: () => setFocused(false) };
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3_000);
  });
  await act(async () => view.result.current.blur());
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2_000);
  });
  expect(refetch).not.toHaveBeenCalled();
});
