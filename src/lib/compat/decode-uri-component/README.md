# Decoder compatibility

Expo Router 57 uses query-string 7, which calls the decoder's CommonJS export.
The patched decoder 0.5.0 is ESM-only. This adapter exposes its default function
without copying or modifying the upstream decoding algorithm.

The root dependency and scoped override route query-string through this local
package. Its npm alias installs the official 0.5.0 tarball with lockfile integrity
verification. Node 22 and Metro support this module boundary. Keep the adapter
until Expo Router ships a compatible dependency update, then remove both the
root dependency and override together. Jest also transforms the aliased ESM
package; remove that exception when the adapter is removed.

`queryString.test.ts` checks the actual dependency resolved by Expo Router,
including Unicode, repeated values, malformed input and an input that times out
with the old decoder. Platform exports and browser navigation additionally check
Metro's resolution of the adapter.

Upstream fix: [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
