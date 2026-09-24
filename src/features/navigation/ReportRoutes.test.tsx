import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExpoRoot, Slot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import FieldLayout from '../../../app/(app)/field/_layout';
import ReportLayout from '../../../app/(app)/field/report/_layout';
import { ReportMethodLinks } from '../field-reports/ReportMethodLinks';
import { VoiceReportScreen } from '../field-reports/VoiceReportScreen';

jest.mock('@expo/vector-icons/Feather', () => () => null);

const context = getMockContext({
  _layout: () => <Slot />,
  '(app)/_layout': () => <Slot />,
  '(app)/field/_layout': FieldLayout,
  '(app)/field/index': () => <Text>Field home</Text>,
  '(app)/field/work': () => <Text>Work destination</Text>,
  '(app)/field/reports': () => <Text>Reports destination</Text>,
  '(app)/field/report/_layout': ReportLayout,
  '(app)/field/report/index': VoiceReportScreen,
  '(app)/field/report/text': () => (
    <View>
      <ReportMethodLinks active="text" />
      <Text>Typed report destination</Text>
    </View>
  ),
  '(app)/field/report/photo': () => (
    <View>
      <ReportMethodLinks active="photo" />
      <Text>Photo report destination</Text>
    </View>
  ),
});

function expectFieldTabs() {
  for (const label of ['Home', 'Report', 'My work', 'My reports'])
    expect(screen.getByLabelText(label)).toBeVisible();
  expect(screen.queryByText('report/text')).toBeNull();
  expect(screen.queryByText('report/photo')).toBeNull();
  expect(screen.getAllByRole('button')).toHaveLength(4);
}

it('keeps all report methods under four Field tabs and exposes them on non-Android platforms', async () => {
  await render(<ExpoRoot context={context} location="/field" />);
  await screen.findByText('Field home');
  expectFieldTabs();
  await fireEvent.press(screen.getByLabelText('Report'));
  await screen.findByText('Voice capture requires the Android app');
  await fireEvent.press(screen.getByRole('link', { name: 'Type' }));
  await screen.findByText('Typed report destination');
  expectFieldTabs();
  await fireEvent.press(screen.getByRole('link', { name: 'Photo' }));
  await screen.findByText('Photo report destination');
  expectFieldTabs();
});

it.each([
  ['text', 'Typed report destination'],
  ['photo', 'Photo report destination'],
])(
  'opens a direct %s link inside the selected Report tab',
  async (method, text) => {
    await render(
      <ExpoRoot context={context} location={`/field/report/${method}`} />,
    );
    await screen.findByText(text);
    expectFieldTabs();
    expect(
      screen.getByLabelText('Report').props.accessibilityState.selected,
    ).toBe(true);
  },
);
