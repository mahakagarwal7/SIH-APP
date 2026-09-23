import { render, screen } from '@testing-library/react-native';

import { LaunchScreen } from './LaunchScreen';

describe('foundation launch', () => {
  it('renders an accessible welcome before backend configuration exists', async () => {
    await render(<LaunchScreen />);

    expect(
      screen.getByRole('header', { name: 'Hello Nirmaan.' }),
    ).toBeVisible();
    expect(screen.getByText('Mobile preview')).toBeVisible();
  });
});
