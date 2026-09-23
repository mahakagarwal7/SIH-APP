# Nirmaan Mobile

The Expo companion to [IntelliGrid](https://intelligrid-sih122.vercel.app), using the existing production Supabase backend. The owner confirmed **Nirmaan** as the mobile name on 23 September 2026.

Roadmap **1.4** adds the native Check → Send screen after the durable 1.5 outbox. Workers compare the verified voice transcript with editable wording, record an optional work date and authorized activity, explicitly check unfinished work, and persist one immutable payload before `submit_field_capture`. Offline confirmations send on reconnect without collapsing Awaiting review into Accepted. Project switching and manager operations remain later slices.

## Run locally

Use the Node version in `.node-version` (22.19.0), then:

```sh
npm ci
npm start
```

Use `npm run android` to generate/build/install a local Android debug app with a compatible JDK, Android SDK and emulator/device. The approved package ID is `com.mahakagarwal.nirmaan`; debug signing is separate from release signing. Voice capture, outbox delivery and confirmation require the native build. Web shows an unavailable state for native capture/sync. See [voice capture and build evidence](docs/VOICE_CAPTURE.md), the [text/photo persistence contract](docs/TEXT_PHOTO_CAPTURE.md), the [outbox contract](docs/OUTBOX_SYNC.md) and the [confirmation contract](docs/CONFIRMATION_SUBMISSION.md).

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
- `.github/workflows/ci.yml`: required checks.

Feature folders are added when their roadmap slice needs them.

## Project references

Read [AGENTS.md](AGENTS.md), [CODEX.md](CODEX.md), [RULES.md](RULES.md), [architecture](ARCHITECTURE.md), [features](FEATURES.md) and [roadmap](ROADMAP.md) before implementation.

The [project review](docs/PROJECT_REVIEW.md) records verified backend contracts and unresolved decisions. The [development workflow](docs/DEVELOPMENT_WORKFLOW.md) supersedes the historical prohibitions on remote actions: signed commits, pushes and feature PRs are authorized; merges remain with the owner. Work stops after each requested slice.

[Confirmation/submission PR draft](docs/pr-drafts/1.4-confirmation-submission.md) records this slice's validation and manual checks. The [outbox/My reports draft](docs/pr-drafts/1.5-outbox-my-reports.md), [text/photo draft](docs/pr-drafts/1.3-text-photo-capture.md), [voice draft](docs/pr-drafts/1.2-voice-capture.md), [My work draft](docs/pr-drafts/1.1-my-work.md) and [contract](docs/MY_WORK_CONTRACT.md), [navigation draft](docs/pr-drafts/0.3-navigation-shell.md), [auth draft](docs/pr-drafts/0.2-auth-session.md) and [foundation draft](docs/pr-drafts/0.1-project-foundation.md) record their respective scope. The supplied PDFs remain local design references: the Nirmaan book governs appearance; the SitePulse reference contributes interaction ideas only.
