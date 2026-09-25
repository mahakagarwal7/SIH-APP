import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { ProjectSwitcherScreen } from './ProjectSwitcherScreen';
import { useProjectSelection } from './useProjectSelection';

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('./useProjectSelection', () => ({ useProjectSelection: jest.fn() }));
jest.mock('@/features/navigation/shellUi', () => ({
  BackButton: () => null,
  ShellPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  shellStyles: {
    body: {},
    cardTitle: {},
    heading: {},
    linkText: {},
  },
}));

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(),
  replace: jest.fn(),
};
const current = {
  member: {
    project_id: 'project-one',
    user_id: 'reporter',
    display_name: 'Field worker',
    role: 'reporter' as const,
    active: true,
    version: 1,
  },
  project: { id: 'project-one', name: 'Project One' },
};
const next = {
  ...current,
  member: { ...current.member, project_id: 'project-two', version: 2 },
  project: { id: 'project-two', name: 'Project Two' },
};

beforeEach(() => {
  mockRouter.back.mockReset();
  mockRouter.canGoBack.mockReset().mockReturnValue(true);
  mockRouter.replace.mockReset();
  jest.mocked(useProjectSelection).mockReturnValue({
    data: current,
    projects: [current, next],
    error: null,
    isPending: false,
    isFetching: false,
    offline: false,
    remembered: false,
    refetch: jest.fn(),
    select: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useProjectSelection>);
});

it('returns to the invoking workspace after selecting a project', async () => {
  await render(<ProjectSwitcherScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Select Project Two' }),
  );

  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('uses the workspace chooser when opened without a prior route', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  await render(<ProjectSwitcherScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Select Project Two' }),
  );

  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/workspaces'),
  );
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('explains when the selected project is the only available choice', async () => {
  jest.mocked(useProjectSelection).mockReturnValue({
    data: current,
    projects: [current],
    error: null,
    isPending: false,
    isFetching: false,
    offline: false,
    remembered: false,
    refetch: jest.fn(),
    select: jest.fn(),
  } as unknown as ReturnType<typeof useProjectSelection>);

  await render(<ProjectSwitcherScreen />);
  expect(
    screen.getByText('This is the only project available to your account.'),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Project One, Selected' }),
  ).toBeDisabled();
});
