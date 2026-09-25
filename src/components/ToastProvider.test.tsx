import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LocalizedPressable as Pressable } from '@/features/localization/LocalizedText';

import { ToastProvider, useToast } from './ToastProvider';

function Trigger() {
  const { showToast } = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => showToast('Report sent for review.')}
    />
  );
}

it('shows a non-blocking app toast and dismisses it automatically', async () => {
  await render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  jest.useFakeTimers();
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getByText('Report sent for review.')).toBeVisible();
  await act(() => jest.advanceTimersByTime(3_000));
  expect(screen.queryByText('Report sent for review.')).toBeNull();
  jest.useRealTimers();
});
