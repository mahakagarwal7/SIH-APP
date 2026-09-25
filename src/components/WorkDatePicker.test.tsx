import { fireEvent, render, screen } from '@testing-library/react-native';

import { WorkDatePicker } from './WorkDatePicker.native';

const mockDateTimePicker = jest.fn();

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { createElement } = jest.requireActual(
      'react',
    ) as typeof import('react');
    const { Pressable, Text } = jest.requireActual(
      'react-native',
    ) as typeof import('react-native');
    mockDateTimePicker(props);
    return createElement(
      Pressable,
      {
        accessibilityLabel: 'Native calendar',
        onPress: () => {
          const onChange = props['onChange'] as Function;
          onChange({ type: 'set' }, new Date(2026, 8, 20));
        },
      },
      createElement(Text, null, 'Native calendar'),
    );
  },
}));

it('defaults the picker to local today without recording it on open', async () => {
  const onChange = jest.fn();
  await render(
    <WorkDatePicker
      label="Work date"
      now={new Date(2026, 8, 25, 18, 30)}
      onChange={onChange}
      value={null}
    />,
  );

  expect(screen.getByText('Not recorded')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Choose work date' }),
  );

  expect(onChange).not.toHaveBeenCalled();
  expect(mockDateTimePicker).toHaveBeenLastCalledWith(
    expect.objectContaining({
      value: new Date(2026, 8, 25),
      maximumDate: new Date(2026, 8, 25),
    }),
  );
});

it('records an explicitly selected date and displays it readably', async () => {
  const onChange = jest.fn();
  const view = await render(
    <WorkDatePicker
      label="Work date"
      locale="en-GB"
      now={new Date(2026, 8, 25)}
      onChange={onChange}
      value={null}
    />,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Choose work date' }),
  );
  await fireEvent.press(screen.getByLabelText('Native calendar'));
  await fireEvent.press(screen.getByRole('button', { name: 'Use date' }));
  expect(onChange).toHaveBeenCalledWith('2026-09-20');

  await view.rerender(
    <WorkDatePicker
      label="Work date"
      locale="en-GB"
      now={new Date(2026, 8, 25)}
      onChange={onChange}
      value="2026-09-20"
    />,
  );
  expect(screen.getByText('20 Sept 2026')).toBeVisible();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Clear work date' }),
  );
  expect(onChange).toHaveBeenLastCalledWith(null);
});
