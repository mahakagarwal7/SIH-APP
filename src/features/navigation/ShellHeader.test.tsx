import { render, screen } from '@testing-library/react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useProjectSelection } from '@/features/projects/useProjectSelection';

import { ShellHeader } from './ShellHeader';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/projects/useProjectSelection', () => ({
  useProjectSelection: jest.fn(),
}));
jest.mock('expo-router', () => ({ usePathname: () => '/field/work' }));
jest.mock('./shellUi', () => ({
  NavLink: ({ label }: { label: string }) => {
    const { Text } = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');
    return <Text>{label}</Text>;
  },
  shellStyles: { heading: {} },
}));

it('keeps project and workspace switching in the persistent header', async () => {
  jest.mocked(useAuth).mockReturnValue({ offline: false } as never);
  jest.mocked(useProjectSelection).mockReturnValue({
    data: { project: { name: 'Town XYZ' } },
    error: null,
    isPending: false,
  } as never);
  await render(<ShellHeader />);
  expect(screen.getByText('Switch workspace')).toBeVisible();
  expect(screen.getByText('Change project')).toBeVisible();
  expect(screen.getByText('Town XYZ')).toBeVisible();
});
