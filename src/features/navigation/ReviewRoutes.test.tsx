import { act, render, screen } from '@testing-library/react-native';
import { ExpoRoot, router, Slot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { Text } from 'react-native';

import ManagerLayout from '../../../app/(app)/manager/_layout';
import ReviewLayout from '../../../app/(app)/manager/review/_layout';

jest.mock('@expo/vector-icons/Feather', () => () => null);

const context = getMockContext({
  _layout: () => <Slot />,
  '(app)/_layout': () => <Slot />,
  '(app)/manager/_layout': ManagerLayout,
  '(app)/manager/index': () => <Text>Project overview</Text>,
  '(app)/manager/schedule': () => <Text>Project schedule</Text>,
  '(app)/manager/history': () => <Text>Project history</Text>,
  '(app)/manager/review/_layout': ReviewLayout,
  '(app)/manager/review/index': () => <Text>Claim queue</Text>,
  '(app)/manager/review/[claimId]': () => <Text>Claim decision</Text>,
});

it('keeps claim detail inside Review with exactly four Manager tabs', async () => {
  await render(<ExpoRoot context={context} location="/manager/review" />);
  await screen.findByText('Claim queue');
  await act(async () => {
    router.push('/manager/review/test-claim');
  });
  await screen.findByText('Claim decision');
  for (const label of ['Overview', 'Review', 'Schedule', 'History'])
    expect(screen.getByLabelText(label)).toBeVisible();
  expect(screen.getAllByRole('button')).toHaveLength(4);
  expect(
    screen.getByLabelText('Review').props.accessibilityState.selected,
  ).toBe(true);
  await act(async () => {
    router.back();
  });
  await screen.findByText('Claim queue');
});
