import { Buffer } from 'node:buffer';

import type { ConfigContext, ExpoConfig } from 'expo/config';

export function publicConnection(
  environment: Record<string, string | undefined>,
): { url: string; key: string } | null {
  const rawUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error();
  } catch {
    throw new Error(
      'Supabase URL must be an HTTPS origin without credentials.',
    );
  }
  let isPublic = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!isPublic) {
    try {
      const parts = key.split('.');
      const payload: unknown = JSON.parse(
        Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'),
      );
      // This is an exposure guard, not signature verification or authorization.
      isPublic =
        parts.length === 3 &&
        typeof payload === 'object' &&
        payload !== null &&
        'role' in payload &&
        payload.role === 'anon';
    } catch {
      isPublic = false;
    }
  }
  if (!isPublic)
    throw new Error('Use a Supabase publishable key or legacy anon key.');
  return { url: url.origin, key };
}

export default function configure({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: 'Nirmaan',
    slug: 'nirmaan-mobile',
    extra: { supabase: publicConnection(process.env) },
  };
}
