import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { secureStorage } from '@/lib/secureStorage';

import { LanguageSelector } from './LanguageSelector';
import {
  isAppLocale,
  LANGUAGE_KEY,
  LocalizationProvider,
  translateText,
} from './LocalizationProvider';
import { LocalizedText as Text } from './LocalizedText';

jest.mock('@/lib/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const storage = secureStorage as jest.Mocked<typeof secureStorage>;

beforeEach(() => {
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
});

it('accepts only supported persisted locale values', () => {
  expect(isAppLocale('en')).toBe(true);
  expect(isAppLocale('hi')).toBe(true);
  expect(isAppLocale('ta')).toBe(false);
  expect(isAppLocale(null)).toBe(false);
});

it('localizes interpolated accessibility copy without changing identifiers', () => {
  expect(translateText('Filter history to ACT-17', 'hi')).toBe(
    'इतिहास को ACT-17 तक सीमित करें',
  );
  expect(translateText('Selected photo 2', 'hi')).toBe('चयनित फ़ोटो 2');
});

it('restores Hindi and localizes visible and accessibility copy', async () => {
  storage.getItem.mockResolvedValue('hi');
  await render(
    <LocalizationProvider>
      <Text accessibilityLabel="Back">Back</Text>
    </LocalizationProvider>,
  );

  await waitFor(() => expect(screen.getByText('वापस')).toBeTruthy());
  expect(screen.getByLabelText('वापस')).toBeTruthy();
});

it('persists a deliberate language choice', async () => {
  await render(
    <LocalizationProvider>
      <LanguageSelector />
    </LocalizationProvider>,
  );

  await fireEvent.press(screen.getByLabelText('हिन्दी'));

  await waitFor(() => {
    expect(storage.setItem).toHaveBeenCalledWith(LANGUAGE_KEY, 'hi');
    expect(screen.getByText('भाषा')).toBeTruthy();
  });
});

it('keeps the current language when preference persistence fails', async () => {
  storage.setItem.mockRejectedValue(new Error('storage unavailable'));
  await render(
    <LocalizationProvider>
      <LanguageSelector />
    </LocalizationProvider>,
  );

  await fireEvent.press(screen.getByLabelText('हिन्दी'));

  await waitFor(() => {
    expect(screen.getByText('Language')).toBeTruthy();
    expect(
      screen.getByText('Language preference could not be saved. Try again.'),
    ).toBeTruthy();
  });
});
