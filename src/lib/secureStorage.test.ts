import * as SecureStore from 'expo-secure-store';

import { secureStorage, SecureStorageError } from './secureStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
}));

describe('secure auth storage', () => {
  beforeEach(() => jest.resetAllMocks());

  it('preserves a large session through a write/read round trip', async () => {
    const values = new Map<string, string>();
    jest
      .mocked(SecureStore.setItemAsync)
      .mockImplementation(async (key, value) => {
        values.set(key, value);
      });
    jest
      .mocked(SecureStore.getItemAsync)
      .mockImplementation(async (key) => values.get(key) ?? null);
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      values.delete(key);
    });
    const session = JSON.stringify({
      token: 'synthetic'.repeat(700),
      displayName: 'नाम',
    });
    await secureStorage.setItem('auth-test', session);
    expect(await secureStorage.getItem('auth-test')).toBe(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-test',
      session,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
    await secureStorage.removeItem('auth-test');
    expect(await secureStorage.getItem('auth-test')).toBeNull();
  });

  it.each(['get', 'set', 'remove'] as const)(
    'surfaces %s failures without token or native error details',
    async (operation) => {
      const failure = new Error('native error with synthetic-sensitive-value');
      jest.mocked(SecureStore.getItemAsync).mockRejectedValue(failure);
      jest.mocked(SecureStore.setItemAsync).mockRejectedValue(failure);
      jest.mocked(SecureStore.deleteItemAsync).mockRejectedValue(failure);
      const call =
        operation === 'get'
          ? secureStorage.getItem('auth-test')
          : operation === 'set'
            ? secureStorage.setItem('auth-test', 'synthetic')
            : secureStorage.removeItem('auth-test');
      await expect(call).rejects.toEqual(new SecureStorageError());
    },
  );
});
