# Field preview APK

The Field preview is an ARM64 Android release APK for physical-device acceptance. It uses package ID `com.mahakagarwal.nirmaan`, includes the production JavaScript bundle, and uses the approved local Android debug certificate. It is not a store or production-signing artifact.

## Build

Create the ignored `.env.local` with the public production connection values named in `.env.example`, then run on Windows:

```powershell
npm run android:preview
```

The command generates the ignored Expo Android project, initializes Worklets CMake metadata, builds only `arm64-v8a` with Gradle project parallelism disabled, verifies the APK signature and bundled JavaScript, and writes the ignored artifact to `dist/nirmaan-field-preview-arm64.apk`. Serial Gradle execution avoids concurrent React Native CMake tasks. The wrapper grants unnamed Java modules native access for the build process so Android Prefab does not misclassify the JDK restricted-access warning as a CMake error. The command never prints either public connection value. Android Studio's JBR and the SDK under `%LOCALAPPDATA%\Android\Sdk` are used when `JAVA_HOME` and `ANDROID_HOME` are absent.

For build-path validation before public configuration is available, run the script directly with `-AllowMissingPublicConfig`. That APK opens the application's honest setup-unavailable state and must not be presented as an acceptance build.

Install the configured preview on a connected ARM64 device:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\dist\nirmaan-field-preview-arm64.apk
```

The preview does not require Metro. Release/store signing remains a separate delivery decision.

## Verified locally on 24 September 2026

- Source before adding this reproducibility wrapper: commit `51f93a2faa5bf02716d32a88aea2d246e9cb44a2`.
- Windows build host, Node 22, Android Studio JBR 21.0.10, Gradle 9.3.1.
- Android compile/target SDK 36, build tools 36.0.0, NDK 27.1.12297006.
- `:app:createBundleReleaseJsAndAssets` wrote `index.android.bundle` into the release assets.
- The build was constrained to `arm64-v8a`, contained `assets/index.android.bundle`, and used the generated release variant's approved debug signing configuration.
- Package: `com.mahakagarwal.nirmaan`; version code `1`; version name `0.1.0`; minimum SDK 24; target SDK 36.
- Artifact: `dist/nirmaan-field-preview-arm64.apk`; 50,063,392 bytes.
- SHA-256: `b988717a65505a5f841673ad03ca77edb8fff0f46a19dd9a5960df6c7da0a44c`.
- `apksigner` verified APK Signature Scheme v2 with one signer. Certificate: Android Debug, RSA 2048, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

No physical device was connected during this check. The local production URL exists, but the publishable key is still empty, so login, restart, real media capture, offline recovery, web arrival and accepted-status evidence remain pending. The generated APK is therefore structural build evidence rather than an acceptance build.

## Physical-device acceptance record

Record the phone model and Android version, the source commit and APK SHA-256, then observe each item rather than inferring it from unit tests:

1. Install the APK and cold-launch it with Metro stopped.
2. Sign in as the designated scoped Field account and restart the app to prove session restore.
3. Record a real voice note and attach a real photo.
4. Enable airplane mode, save, kill and reopen the app, and confirm the draft and media remain.
5. Reconnect and confirm one report reaches the planner web app without duplicate captures.
6. Accept or partly accept the report on web and confirm the terminal status appears under My reports.

Also exercise microphone/camera denial, expired authentication, failed processing and revoked membership when suitable test records are available.
