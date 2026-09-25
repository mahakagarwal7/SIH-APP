# Field preview APK

The Field preview is an ARM64 Android release APK for physical-device acceptance. It uses package ID `com.mahakagarwal.nirmaan`, includes the production JavaScript bundle, and uses the approved local Android debug certificate. It is not a store or production-signing artifact.

## Build

Create the ignored `.env.local` with the public production connection values named in `.env.example`, then run on Windows:

```powershell
npm run android:preview
```

The command removes any previous configured or setup-unavailable APK before starting, generates the ignored Expo Android project, initializes Worklets CMake metadata, builds only `arm64-v8a` with Gradle project parallelism disabled, verifies the APK signature and bundled JavaScript, and writes the configured artifact to `dist/nirmaan-field-preview-arm64.apk`. Serial Gradle execution avoids concurrent React Native CMake tasks. The wrapper grants unnamed Java modules native access for the build process so Android Prefab does not misclassify the JDK restricted-access warning as a CMake error. The command never prints either public connection value and restores the caller's process environment when it exits. Android Studio's JBR and the SDK under `%LOCALAPPDATA%\Android\Sdk` are used when `JAVA_HOME` and `ANDROID_HOME` are absent.

Run the build-wrapper helper tests from PowerShell before changing its environment or signing checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tests\build-android-preview.tests.ps1
```

The wrapper clears inherited Supabase values before loading `.env.local` and disables Expo's automatic dotenv loading, so another `.env*` file or stale shell variable cannot silently supply a missing key. CI runs the helper tests on Windows. The wrapper accepts exactly the recorded Android debug certificate fingerprint in addition to checking the package signature.

For build-path validation before public configuration is available, run the script directly with `-AllowMissingPublicConfig`. That APK is written to `dist/nirmaan-field-preview-arm64-setup-unavailable.apk`, separate from the configured acceptance filename, and opens the application's honest setup-unavailable state. Do not present it as an acceptance build.

Install the configured preview on a connected ARM64 device:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\dist\nirmaan-field-preview-arm64.apk
```

The preview does not require Metro. Release/store signing remains a separate delivery decision.

## Automatic previews from main

Every push or merge to `main` runs CI. After the Android helper, typecheck,
lint, formatting, tests and bundle check pass, CI calls the Release workflow
to build the exact checked commit as an ARM64 APK. The build requires the
repository's public Supabase configuration secrets; a missing value fails the
run instead of publishing a setup-unavailable APK. It stamps Android
`versionCode` from the commit's history count, so later main builds can be
installed over earlier previews signed by the same certificate.

Each successful build uploads a 30-day Actions artifact and publishes an
automatically named **prerelease** with the APK and `SHA256SUMS.txt` on the
[GitHub Releases page](https://github.com/mahakagarwal7/SIH-APP/releases).
The prerelease records its source commit, version code and checksum. If main
moves during a build, the old build is not published as the current preview.
Tagged `v*` releases remain a separate, explicit path. This is an installable
debug-signed preview, not physical-device acceptance or a store release.
Android does not install a newly published APK by itself: download the latest
prerelease, verify its checksum and use `adb install -r` or the device's file
installer to update an existing copy.

## Manual build without publishing

After the repository Actions secrets `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured with the public production
values, run the Release workflow manually with the **tag input left blank**.
The workflow builds the same verified ARM64 APK and uploads it as the
`nirmaan-field-preview-arm64` run artifact, but does not create a GitHub Release.
Download the APK and `SHA256SUMS.txt` from that run and compare the checksum
before installing it. Record the run's source commit and complete the physical
device checks below before distributing it.

A pushed `v*` tag, or a manual run with an existing tag, still publishes a
versioned GitHub Release. Do not use a version tag for a build-only
verification run.

## Current APK build evidence — 25 September 2026

The [build-only run](https://github.com/mahakagarwal7/SIH-APP/actions/runs/36124563966)
built main commit `3e77ae571c84eee93dd27903edabe754885b8981`, including
PRs #35, #38 and #37, with the public production Supabase configuration
supplied by repository Actions secrets. The artifact contains
`nirmaan-field-preview-arm64.apk` and `SHA256SUMS.txt`; the
publish step was skipped, so no GitHub Release was created. The workflow passed
typecheck, lint, tests, native build and upload, and its wrapper checked the
package ID, ARM64-only ABI, bundled JavaScript and APK signature.

- Package: `com.mahakagarwal.nirmaan`; ABI: `arm64-v8a`.
- Size: 58,876,771 bytes.
- SHA-256: `fb8ac00e40af5dfc71a1944e889f8aea33fcb4a2d41fc24243bc9cffa1ad5191`.
- APK Signature Scheme v2 verified with the approved Android debug certificate,
  SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- The artifact was downloaded locally; `sha256sum -c SHA256SUMS.txt` and ZIP
  integrity inspection both passed.

This is build evidence, not physical-device acceptance. Install this exact APK
and complete the checks below before distributing it to field users. A later
documentation-only commit does not alter the built app or workflow; use the
recorded source commit and checksum to identify the tested binary.

## Earlier configured artifact evidence — superseded

The [earlier build-only run](https://github.com/mahakagarwal7/SIH-APP/actions/runs/36115406349)
built commit `866de57ca530865c37c43beed4573cf90e5be3fe` before PRs #35,
#38 and #37. Its 58,859,491-byte APK has SHA-256
`61796626c494d7196eeb7febfd0981b8de610ae6148dae7a9068fccd15111730`.
Do not use it for current-head acceptance.

## Earlier structural artifact evidence — superseded

The artifact recorded below was built from commit `51f93a2faa5bf02716d32a88aea2d246e9cb44a2`, before the report-status, outbox and current build-wrapper fixes. It is stale and must not be used for physical-device acceptance. Use the newer build recorded above.

The earlier build was verified on 24 September 2026 with these details:

- Windows build host, Node 22, Android Studio JBR 21.0.10, Gradle 9.3.1.
- Android compile/target SDK 36, build tools 36.0.0, NDK 27.1.12297006.
- `:app:createBundleReleaseJsAndAssets` wrote `index.android.bundle` into the release assets.
- The build was constrained to `arm64-v8a`, contained `assets/index.android.bundle`, and used the generated release variant's approved debug signing configuration.
- Package: `com.mahakagarwal.nirmaan`; version code `1`; version name `0.1.0`; minimum SDK 24; target SDK 36.
- Artifact from the older source: `dist/nirmaan-field-preview-arm64.apk`; 50,063,392 bytes.
- SHA-256: `b988717a65505a5f841673ad03ca77edb8fff0f46a19dd9a5960df6c7da0a44c`.
- `apksigner` verified APK Signature Scheme v2 with one signer. Certificate: Android Debug, RSA 2048, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

The build-helper tests added during that earlier review passed under PowerShell 7.4.7 in a Linux container. They did not provide device acceptance evidence.

No physical device was connected during these build checks. Login, restart,
real media capture, offline recovery, web arrival and accepted-status evidence
remain pending for the current configured APK.

## Physical-device acceptance record

Record the phone model and Android version, the source commit and APK SHA-256, then observe each item rather than inferring it from unit tests:

1. Install the APK and cold-launch it with Metro stopped.
2. Sign in as the designated scoped Field account and restart the app to prove session restore.
3. Record a real voice note and attach a real photo.
4. Enable airplane mode, save, kill and reopen the app, and confirm the draft and media remain.
5. Reconnect and confirm one report reaches the planner web app without duplicate captures.
6. Accept or partly accept the report on web and confirm the terminal status appears under My reports.

Also exercise microphone/camera denial, expired authentication, failed processing and revoked membership when suitable test records are available.
