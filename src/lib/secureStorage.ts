import * as SecureStore from 'expo-secure-store';

export class SecureStorageError extends Error {
  constructor() {
    super('Secure storage is unavailable.');
    this.name = 'SecureStorageError';
  }
}

export const secureStorage = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      throw new SecureStorageError();
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      throw new SecureStorageError();
    }
  },
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      throw new SecureStorageError();
    }
  },
};
