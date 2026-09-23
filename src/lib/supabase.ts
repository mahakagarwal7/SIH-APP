import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { withTimeout } from './request';
import { secureStorage } from './secureStorage';

import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type PublicConnection = { url: string; key: string };

export function createAuthClient(
  connection: PublicConnection,
  platform = Platform.OS,
) {
  return createClient<Database>(connection.url, connection.key, {
    auth: {
      storage: platform === 'web' ? undefined : secureStorage,
      persistSession: platform !== 'web',
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: withTimeout(fetch) },
  });
}

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  if (client) return client;
  const connection: unknown = Constants.expoConfig?.extra?.supabase;
  if (
    !connection ||
    typeof connection !== 'object' ||
    !('url' in connection) ||
    !('key' in connection) ||
    typeof connection.url !== 'string' ||
    typeof connection.key !== 'string'
  )
    return null;
  client = createAuthClient({ url: connection.url, key: connection.key });
  return client;
}
