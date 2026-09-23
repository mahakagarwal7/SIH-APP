import { Buffer } from 'node:buffer';

import configure, { publicConnection } from '../../app.config';

const url = 'https://example.supabase.co';
const key = 'sb_publishable_synthetic_test_key_only';

describe('public app configuration', () => {
  it('stays unconfigured when either public value is missing', () => {
    expect(publicConnection({ NEXT_PUBLIC_SUPABASE_URL: url })).toBeNull();
    expect(
      publicConnection({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toBeNull();
  });

  it('allows only the exact public variables and strips surrounding whitespace', () => {
    expect(
      publicConnection({
        NEXT_PUBLIC_SUPABASE_URL: ` ${url}/ `,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ` ${key} `,
        PRIVATE_TEST_VALUE: 'must-not-be-exported',
      }),
    ).toEqual({ url, key });
  });

  it.each([
    'http://example.supabase.co',
    'https://user:password@example.supabase.co',
    'https://example.supabase.co?password=private',
    'not-a-url',
  ])('rejects an unsafe backend URL without echoing it', (value) => {
    expect(() =>
      publicConnection({
        NEXT_PUBLIC_SUPABASE_URL: value,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toThrow('Supabase URL must be an HTTPS origin without credentials.');
  });

  it('rejects secret and service-role keys before they enter the app bundle', () => {
    const jwt = (role: string) =>
      `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.synthetic`;
    for (const unsafeKey of [
      'sb_secret_synthetic_do_not_use',
      jwt('service_role'),
    ]) {
      expect(() =>
        publicConnection({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: unsafeKey,
        }),
      ).toThrow('Use a Supabase publishable key or legacy anon key.');
    }
    expect(
      publicConnection({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('anon'),
      })?.key,
    ).toBe(jwt('anon'));
  });

  it('exports only the connection settings, never arbitrary app extras', () => {
    const result = configure({
      config: {
        name: 'Nirmaan',
        slug: 'nirmaan-mobile',
        extra: { privateValue: 'do-not-export' },
      },
      projectRoot: '.',
      staticConfigPath: null,
      packageJsonPath: null,
    });
    expect(Object.keys(result.extra ?? {})).toEqual(['supabase']);
    expect(JSON.stringify(result)).not.toContain('do-not-export');
  });
});
