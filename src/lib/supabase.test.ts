import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secureStorage';
import { createAuthClient, getSupabase } from './supabase';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { supabase: null } } },
}));

describe('Supabase client boundary', () => {
  it('does not construct a client without complete public configuration', () => {
    expect(getSupabase()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('persists native sessions only in SecureStore', () => {
    createAuthClient(
      {
        url: 'https://example.supabase.co',
        key: 'sb_publishable_synthetic_test_key_only',
      },
      'android',
    );
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_synthetic_test_key_only',
      expect.objectContaining({
        auth: {
          storage: secureStorage,
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    );
  });

  it('keeps browser previews in memory without localStorage persistence', () => {
    createAuthClient(
      {
        url: 'https://example.supabase.co',
        key: 'sb_publishable_synthetic_test_key_only',
      },
      'web',
    );
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: undefined,
          persistSession: false,
          detectSessionInUrl: false,
        }),
      }),
    );
  });
});
