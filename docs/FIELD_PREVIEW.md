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

## Build from GitHub Actions without publishing

After the repository Actions secrets `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured with the public production
values, run the Release workflow manually with the **tag input left blank**.
The workflow builds the same verified ARM64 APK and uploads it as the
`nirmaan-field-preview-arm64` run artifact, but does not create a GitHub Release.
Download the APK and `SHA256SUMS.txt` from that run and compare the checksum
before installing it. Record the run's source commit and complete the physical
device checks below before distributing it.

A pushed `v*` tag, or a manual run with an existing tag, still publishes a
GitHub Release. Do not use a version tag for a build-only verification run.

## Current APK build evidence — 25 September 2026

The [build-only run](https://github.com/mahakagarwal7/SIH-APP/actions/runs/36115406349)
built commit `866de57ca530865c37c43beed4573cf90e5be3fe` with the public
production Supabase configuration supplied by repository Actions secrets. The
artifact contains `nirmaan-field-preview-arm64.apk` and `SHA256SUMS.txt`; the
publish step was skipped, so no GitHub Release was created. The workflow passed
typecheck, lint, tests, native build and upload, and its wrapper checked the
package ID, ARM64-only ABI, bundled JavaScript and APK signature.

- Package: `com.mahakagarwal.nirmaan`; ABI: `arm64-v8a`.
- Size: 58,859,491 bytes.
- SHA-256: `61796626c494d7196eeb7febfd0981b8de610ae6148dae7a9068fccd15111730`.
- APK Signature Scheme v2 verified with the approved Android debug certificate,
  SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

This is build evidence, not physical-device acceptance. Install this exact APK
and complete the checks below before distributing it to field users. A later
documentation-only commit does not alter the built app or workflow; use the
recorded source commit and checksum to identify the tested binary.

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

No physical device was connected during either build check. Login, restart, real media capture, offline recovery, web arrival and accepted-status evidence remain pending for the current configured APK.

## Physical-device acceptance record

Record the phone model and Android version, the source commit and APK SHA-256, then observe each item rather than inferring it from unit tests:

1. Install the APK and cold-launch it with Metro stopped.
2. Sign in as the designated scoped Field account and restart the app to prove session restore.
3. Record a real voice note and attach a real photo.
4. Enable airplane mode, save, kill and reopen the app, and confirm the draft and media remain.
5. Reconnect and confirm one report reaches the planner web app without duplicate captures.
6. Accept or partly accept the report on web and confirm the terminal status appears under My reports.

Also exercise microphone/camera denial, expired authentication, failed processing and revoked membership when suitable test records are available.
