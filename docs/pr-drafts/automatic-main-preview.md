# Automatic main APK preview

## What changed

- A successful `main` CI run now calls the existing Windows Release workflow
  for the exact CI commit. Pull requests continue to run checks without
  receiving release secrets or producing APKs.
- Each build receives a monotonic Android version code from its commit count,
  verifies that code in the generated APK, uploads a 30-day Actions artifact
  and publishes a persistent GitHub
  prerelease with the APK, checksum and source commit.
- Manual artifact-only runs and explicit `v*` tag releases remain available.
  An automatic build checks the current main commit before publishing so a
  superseded build cannot become the newest preview.

## Verification

- Validate the workflow syntax and run the repository's typecheck, lint,
  formatting, Jest and bundle checks.
- Observe PR CI. After merge, observe main CI's Release job build the APK and
  publish a prerelease. Download its APK and verify `SHA256SUMS.txt`.

## Device check

Install the new APK over the previous debug-signed ARM64 preview with
`adb install -r`; confirm it launches without Metro and preserves the existing
sign-in/draft state. A real Field account and physical device remain required
for product acceptance.
