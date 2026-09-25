import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { AlertsPreviewScreen } from './AlertsPreviewScreen';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

it('renders an unmistakable reference-only alerts and approvals shell', async () => {
  await render(<AlertsPreviewScreen />);

  expect(
    screen.getByRole('header', { name: 'Alerts & Approvals' }),
  ).toBeVisible();
  expect(
    screen.getByText(
      'DESIGN PREVIEW · No live alerts or approvals are connected.',
    ),
  ).toBeVisible();
  expect(screen.getByText('Critical delay example')).toBeVisible();
  expect(screen.getByText('Approved inspection example')).toBeVisible();
  expect(screen.getByText('Pending approval example')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open settings' })).toBeVisible();
  expect(
    screen.getByLabelText('Reference navigation preview. Alerts selected.'),
  ).toBeVisible();
});

it('filters only the local demo fixtures and keeps counts honest', async () => {
  await render(<AlertsPreviewScreen />);

  const critical = screen.getByRole('button', { name: 'Critical, 1' });
  const pending = screen.getByRole('button', { name: 'Pending, 1' });
  expect(critical).toHaveProp('accessibilityState', { selected: false });

  await fireEvent.press(critical);
  expect(critical).toHaveProp('accessibilityState', { selected: true });
  expect(screen.getByText('Critical delay example')).toBeVisible();
  expect(screen.queryByText('Approved inspection example')).toBeNull();
  expect(screen.queryByText('Pending approval example')).toBeNull();

  await fireEvent.press(pending);
  expect(pending).toHaveProp('accessibilityState', { selected: true });
  expect(screen.getByText('Pending approval example')).toBeVisible();
  expect(screen.queryByText('Critical delay example')).toBeNull();
});

it('explains that demo details have no live record', async () => {
  await render(<AlertsPreviewScreen />);

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'View details for Critical delay example',
    }),
  );

  expect(
    screen.getByText(
      'Preview only · Critical delay example has no live record.',
    ),
  ).toBeVisible();
});
