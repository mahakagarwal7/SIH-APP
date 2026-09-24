import { execFileSync } from 'node:child_process';

// Exercise the real dependency resolved by Expo Router, including its CommonJS
// boundary. A child process also bounds a malformed-input regression safely.
const loadRouterQueryString = `
  const assert = require('node:assert/strict');
  const { createRequire } = require('node:module');
  const fromRouter = createRequire(require.resolve('expo-router/package.json'));
  const queryString = fromRouter('query-string');
`;

function checkQueryString(assertions: string) {
  execFileSync(process.execPath, ['-e', loadRouterQueryString + assertions], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 3000,
    stdio: 'pipe',
  });
}

describe('Expo Router query decoding', () => {
  it('preserves route query parsing and serialization through the CommonJS interface', () => {
    checkQueryString(`
      const parsed = queryString.parse(
        'name=Line+%E2%82%AC&literal=%2B&once=%252F&tag=a&tag=b&empty=&flag'
      );
      assert.deepEqual({ ...parsed }, {
        name: 'Line \\u20ac', literal: '+', once: '%2F',
        tag: ['a', 'b'], empty: '', flag: null,
      });
      assert.equal(
        queryString.stringify({ name: 'Line \\u20ac', tag: ['a', 'b'], flag: null }),
        'flag&name=Line%20%E2%82%AC&tag=a&tag=b'
      );
      assert.deepEqual(
        { ...queryString.parse('x=%E0%A4%A&y=%GG&z=%FE%FF') },
        { x: '%E0%A4%A', y: '%GG', z: '\\ufffd\\ufffd' }
      );
    `);
  });

  it('finishes decoding a long malformed query within the process deadline', () => {
    checkQueryString(`
      const value = '%FF'.repeat(6000);
      assert.equal(queryString.parse('q=' + value).q, value);
    `);
  });
});
