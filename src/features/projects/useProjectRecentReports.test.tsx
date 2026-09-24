import { useQuery } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));

const { useProjectRecentReports } = jest.requireActual<
  typeof import('./useProjectRecentReports')
>('./useProjectRecentReports.ts');

const refetch = jest.fn();
let currentRefetch: (() => Promise<unknown>) | undefined;

function Harness({
  tick,
  onRefetch,
}: {
  tick: number;
  onRefetch: (refetch: () => Promise<unknown>) => void;
}) {
  const { refetch } = useProjectRecentReports('project');
  useEffect(() => onRefetch(refetch), [onRefetch, refetch]);
  return <Text>{tick}</Text>;
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    session: { user: { id: 'reporter' } },
    offline: false,
  } as never);
  jest.mocked(useQuery).mockReturnValue({
    data: [],
    error: null,
    isPending: false,
    isFetching: false,
    refetch,
  } as never);
});

it('keeps the Home refresh callback stable across query rerenders', async () => {
  const onRefetch = jest.fn((value: () => Promise<unknown>) => {
    currentRefetch = value;
  });
  const view = await render(<Harness tick={0} onRefetch={onRefetch} />);
  const first = currentRefetch;

  await view.rerender(<Harness tick={1} onRefetch={onRefetch} />);

  expect(view.getByText('1')).toBeVisible();
  expect(useQuery).toHaveBeenCalledTimes(2);
  expect(currentRefetch).toBe(first);
});
