# Nirmaan Mobile

The Expo companion to [IntelliGrid](https://intelligrid-sih122.vercel.app), using the existing production Supabase backend. The owner confirmed **Nirmaan** as the mobile name on 23 September 2026.

Roadmap **1.6** completes the Field reporting loop with bounded foreground status polling. My reports now distinguishes production extraction, retry/failure, planner review, clarification, verification and final accepted/rejected/observed outcomes using existing RLS-readable jobs and claims. Offline confirmations still send on reconnect without collapsing submission into acceptance. A reproducible ARM64 standalone preview build is now available for Field acceptance; project switching and manager operations remain later slices.

## Run locally

Use the Node version in `.node-version` (22.19.0), then:

```sh
npm ci
npm start
```

Use `npm run android` to generate/build/install a local Android debug app with a compatible JDK, Android SDK and emulator/device. Use `npm run android:preview` for the verified ARM64 standalone APK after both public production values are configured. The approved package ID is `com.mahakagarwal.nirmaan`; debug signing is separate from release signing. Voice capture, outbox delivery, confirmation and status polling require the native build. Web shows unavailable states for these native flows. See [Field preview build and acceptance](docs/FIELD_PREVIEW.md), [voice capture and build evidence](docs/VOICE_CAPTURE.md), the [text/photo persistence contract](docs/TEXT_PHOTO_CAPTURE.md), the [outbox contract](docs/OUTBOX_SYNC.md), the [confirmation contract](docs/CONFIRMATION_SUBMISSION.md) and the [status contract](docs/REPORT_STATUS.md).

After green CI on `main`, the [Releases page](https://github.com/mahakagarwal7/SIH-APP/releases) receives an automatic ARM64 preview prerelease with the APK and checksum. Installing an updated APK on a device is still a separate step.

Configure the public connection below to sign in with an existing account. Without both values, the app displays an incomplete-setup message. Browser and Metro export checks do not prove installation or operation on a physical device.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run bundle:check
```

CI runs these checks on pull requests and pushes to main. The lockfile records dependency versions. Tests use Jest, the Expo preset and React Native Testing Library.

## Backend configuration

Production is the selected environment. Public client settings must be supplied locally; never put private secrets into source or the app bundle.

For this mobile checkout, copy `.env.example` to the ignored root `.env.local` and supply exactly:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<production URL supplied locally>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key supplied locally>
```

The local file already has the owner-supplied URL. Fill its blank key from Supabase Dashboard > Project Settings > API, then restart with `npx expo start --clear` so Metro does not reuse old configuration. For exports after changing these values, use `npm run bundle:check -- --clear`. `app.config.ts` passes only these public values to `expo-constants`; it rejects secret/service-role keys. These public values are included in the app bundle. Never add a password, service-role key, signing key or other private secret.

Native sessions use `expo-secure-store`. The browser preview keeps sessions in memory only, so reloading the page requires sign-in again. The app restores valid sessions, refreshes while active and connected, and shows sign-in when a session expires. Offline sign-in is unavailable; an unexpired saved session can still be restored. Signing out affects the current device's session.

The separate web checkout uses `apps/web/.env.local` with:

```dotenv
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=<supplied locally>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key supplied locally>
```

The web checkout is `C:\Users\Mahak\SIH-122`. Its local file also has the owner-supplied URL and a blank key. `APP_ORIGIN` belongs to web development and is not a mobile setting. Live production login and physical-device session persistence still need verification after local configuration.

## Project layout

- `app/`: Expo Router entry and auth route.
- `src/features/auth/`: sign-in/account screen, session controller and hook.
- `src/features/navigation/`: protected route boundary, workspace tabs and shared shell UI.
- `src/features/projects/`: default-project access, verified offline capture context and read-only My work.
- `src/features/field-reports/`: native capture, account-scoped drafts, outbox delivery and My reports.
- `src/types/`: scoped database/RPC contract matching the production schema.
- `src/lib/`: Supabase client, secure storage, request timeout and session-scoped query cache.
- `docs/`: decisions, workflow and PR drafts.
- `scripts/`: reproducible local delivery commands that operate on ignored generated native output.
- `.github/workflows/ci.yml`: required checks.

Feature folders are added when their roadmap slice needs them.

## Project references

Read [AGENTS.md](AGENTS.md), [CODEX.md](CODEX.md), [RULES.md](RULES.md), [architecture](ARCHITECTURE.md), [features](FEATURES.md) and [roadmap](ROADMAP.md) before implementation.

The [project review](docs/PROJECT_REVIEW.md) records verified backend contracts and unresolved decisions. The [development workflow](docs/DEVELOPMENT_WORKFLOW.md) supersedes the historical prohibitions on remote actions: signed commits, pushes and feature PRs are authorized; merges remain with the owner. Work stops after each requested slice.

[Field preview PR draft](docs/pr-drafts/1.7-field-preview-apk.md) records the standalone APK evidence and outstanding phone acceptance. The [report status draft](docs/pr-drafts/1.6-report-status.md), [confirmation/submission draft](docs/pr-drafts/1.4-confirmation-submission.md), [outbox/My reports draft](docs/pr-drafts/1.5-outbox-my-reports.md), [text/photo draft](docs/pr-drafts/1.3-text-photo-capture.md), [voice draft](docs/pr-drafts/1.2-voice-capture.md), [My work draft](docs/pr-drafts/1.1-my-work.md) and [contract](docs/MY_WORK_CONTRACT.md), [navigation draft](docs/pr-drafts/0.3-navigation-shell.md), [auth draft](docs/pr-drafts/0.2-auth-session.md) and [foundation draft](docs/pr-drafts/0.1-project-foundation.md) record their respective scope. The supplied PDFs remain local design references: the Nirmaan book governs appearance; the SitePulse reference contributes interaction ideas only.
