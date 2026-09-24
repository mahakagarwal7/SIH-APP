import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExpoRoot, Slot } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { ReportMethodLinks } from './ReportMethodLinks';

const context = getMockContext({
  _layout: () => <Slot />,
  index: () => <ReportMethodLinks active="voice" />,
  'field/report/index': () => <Text>Voice report destination</Text>,
  'field/report/text': () => <Text>Typed report destination</Text>,
  'field/report/photo': () => <Text>Photo report destination</Text>,
});

it.each([
  ['Voice', 'Voice report destination'],
  ['Type', 'Typed report destination'],
  ['Photo', 'Photo report destination'],
])(
  'renders the actual router links and opens %s',
  async (label, destination) => {
    await render(<ExpoRoot context={context} location="/" />);
    const voice = screen.getByRole('link', { name: 'Voice' });
    expect(voice).toHaveStyle({ backgroundColor: '#17354c', minHeight: 48 });
    await fireEvent.press(screen.getByRole('link', { name: label }));
    expect(await screen.findByText(destination)).toBeVisible();
  },
);
