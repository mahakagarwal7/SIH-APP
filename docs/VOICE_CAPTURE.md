# Voice capture — roadmap 1.2

The owner approved evaluating Android PCM16 WAV capture, package ID `com.mahakagarwal.nirmaan`, a local debug build, and SQLite metadata with app-private audio. Unsent drafts survive logout, are visible only to their creating account, and require explicit discard. Release signing, publishing and later upload behavior are separate decisions.

## Recording contract

The reviewed production worker at web commit `c779472cced97006856cfc186c955f69ad7d15ab` validates actual WAV bytes in `packages/adapters/src/wav.ts`. Capture follows that unchanged contract:

| Property           | Requirement                                                       |
| ------------------ | ----------------------------------------------------------------- |
| Container          | RIFF/WAVE with exact declared length                              |
| Encoding           | PCM format 1, signed 16-bit little endian, mono                   |
| Actual sample rate | 16000, 22050, 24000, 44100 or 48000 Hz                            |
| Duration           | 0.2–25 seconds, derived from sample count                         |
| Size               | At most 5 MB; a 25-second, 48 kHz recording is 2,400,044 bytes    |
| Signal             | RMS at least 0.0005, matching the worker's near-silence rejection |

`PcmWavCapture` copies native buffers, rejects unsupported/changed formats, caps samples at 25 seconds, and writes a PCM WAV header. A timer alone is not used as evidence of audio duration. Late callbacks cannot extend a stopped recording.

## Native approach and platform boundary

Expo SDK 57's `expo-audio@57.0.5` exposes a raw PCM stream in addition to its compressed-file recorder. Its installed Android source uses `AudioRecord` with `ENCODING_PCM_16BIT` for `encoding: 'int16'`. We request mono 16 kHz and use the actual rate in every buffer; an unsupported fallback is rejected. See [Expo audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/).

Each attempt owns a separate native stream and listener. Stop releases the microphone, removes listeners, and waits for a pending native start before final native disposal. Permission refusal, duplicate taps, app backgrounding, navigation, session changes, a stalled stream, invalid audio and failed storage have explicit handling. Background recording/playback services are disabled.

The web stream implementation is a stub, and the iOS converter fallback has not been validated for this contract. These platforms show an unavailable state. Expo Go and physical-phone compatibility are not inferred from JavaScript tests or bundling.

## Local persistence and ownership

`nirmaan-drafts.db` contains the local-only `local_voice_drafts` table. This is not a Supabase migration. Queries bind parameters and scope reads, state changes and deletes by the authenticated user ID. UUID filenames are constructed under the app's document directory, never taken from a server response or an arbitrary path.

Saving inserts metadata in `saving` state, writes the durable audio file, checks its size and marks metadata `saved`. SQLite uses WAL and synchronous FULL. Only then does the UI say **Saved on device. Not sent for review.** A failed or interrupted write stays incomplete; a stopped recording remains in memory for retry while the screen remains open. Retry uses the same draft ID. A crash between file write and metadata completion cannot produce a false saved state.

Explicit discard first marks the row `deleting`, removes its file, then removes its metadata. A failed deletion remains visible for retry. Missing media cannot be played and is labeled incomplete or missing. A discard confirmation left open after its account screen unmounts cannot delete that account's draft. Logout clears visible account state while preserving unsent files and metadata. Android backup is disabled for this app; clearing app data or uninstalling removes local drafts.

The capture panel needs the signed-in user's loaded default project. Once loaded, capture and saving work without a network connection. After a cold offline launch, existing drafts can be listed, but new capture waits for project access to load; persistent server-query caching is not implemented in this slice. Local drafts do not establish current backend membership or permission to submit.

There is no reserve, upload, transcription, submission, sync or status polling here. Check/Send, text and photo capture remain later roadmap steps. Nothing is labeled sent or accepted.

## Verification record

- WAV encoder: generated PCM fixtures at all five allowed rates and 0.2, 1 and 25 seconds were accepted by the unchanged worker byte inspector (15 fixtures). These are synthetic encoder checks, not microphone recordings.
- Jest: encoder boundaries; account isolation and SQL parameter binding with real SQLite; incomplete writes and deletion; same-ID retry; recording permission/lifecycle; UI persistence timing, offline listing and stale account/project state.
- Native Android probe, 24 September 2026: the actual Report component, recorder and storage ran in an isolated debug APK with synthetic identities/project access. It never signed into or mutated production. Android API 36 x86_64 with emulator 37.1.11, SwiftShader, Vulkan and VirtioSndCard disabled, used the emulator's built-in virtual microphone tone (approximately 220 Hz). Host microphone access was explicitly disabled. Attempts to use audio injection with the default virtual sound card crashed the emulator; injected audio is not claimed as successful evidence.
- Extracted native WAVs passed the unchanged worker inspector: 5.6 seconds / 179,244 bytes and exactly 25 seconds / 800,044 bytes, both mono PCM16 at 16 kHz. The 25-second file SHA-256 is `5ecfa7b666f6d068c728c40150aba7f5af0a037cadf4532e434819d05aad8b59`; the shorter file is `da1c415a2ce9c31a27c0328db4640473f63afb69036f4764e0759819616072a5`. These are native microphone-path recordings of a virtual tone, not human speech or physical-device evidence.
- Native interactions observed: saved metadata/media survived app force-stop/restart; a second synthetic account saw no drafts; the original account retained playback; canceling discard kept the draft, confirming discard removed it and its original audio file; recording automatically stopped at 25 seconds; backgrounding stopped and saved captured audio. A silent stream was rejected without a saved draft, and denying the native permission dialog displayed the microphone-access error without recording. The offline banner/project context in this probe is a fixture, not an airplane-mode or production-session test.
- Compared the native recording screen with page 9 of the supplied Nirmaan design book: navy/serif hierarchy, Report/Check/Send context, central microphone control, restrained cards and explicit local delivery state. Later confirmation/transcription UI is not simulated.
- Physical-phone microphone quality, hardware sample-rate fallback and interruption behavior remain manual checks.

The Field Report route is connected after the recorded-byte gate passed. Local proof files and screenshots are ignored under `test-results/voice-evaluation/`; synthetic probe auth is never part of the application route or committed configuration.

## Local Android build

`npm run android` uses Expo prebuild and the local Android toolchain to build/install a debug app. This PC's evaluated toolchain is Android Studio JBR 21.0.10, Gradle 9.3.1, Android platform/build tools 36 and NDK 27.1.12297006. Generated `android/` output, debug keys and APKs stay ignored. No release signing or cloud build account is configured by this slice.

The native probe and app debug builds are separate artifacts. The probe APK is 72,612,885 bytes, SHA-256 `8b048cb45255f8ecc65d7a074f8dfa3cc1de9e662aa927da382dca61a9f60ed2`. It loads the actual feature source through a separate ignored Metro harness, with synthetic account/project context. Probe code is not shipped in the app.

The application APK uses native configuration commit `0ac79d4`; its JavaScript loads from the checked-out feature source through Metro. Both local debug builds target x86_64 and require Metro; neither is a standalone release or an ARM phone APK. The exact runtime source commit, app artifact checksum and launch result are recorded in the PR validation record.
