# Nirmaan Mobile

The Expo companion to [IntelliGrid](https://intelligrid-sih122.vercel.app), using the existing production Supabase backend. The owner confirmed **Nirmaan** as the mobile name on 23 September 2026.

Roadmap **0.2** adds email/password sign-in, native secure session storage, session restore and sign-out. Project data, reporting, offline delivery and manager features remain later slices.

## Run locally

Use the Node version in `.node-version` (22.19.0), then:

```sh
npm ci
npm start
```

Use `npm run android` with a compatible Android emulator or device, or `npm run web` for a browser preview. Configure the public connection below to sign in with an existing account. Without both values, the app displays an incomplete-setup message. Browser and Metro export checks do not prove installation or operation on a physical device.

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
- `src/lib/`: Supabase client, secure storage and request timeout.
- `docs/`: decisions, workflow and PR drafts.
- `.github/workflows/ci.yml`: required checks.

Feature folders are added when their roadmap slice needs them.

## Project references

Read [AGENTS.md](AGENTS.md), [CODEX.md](CODEX.md), [RULES.md](RULES.md), [architecture](ARCHITECTURE.md), [features](FEATURES.md) and [roadmap](ROADMAP.md) before implementation.

The [project review](docs/PROJECT_REVIEW.md) records verified backend contracts and unresolved decisions. The [development workflow](docs/DEVELOPMENT_WORKFLOW.md) supersedes the historical prohibitions on remote actions: signed commits, pushes and feature PRs are authorized; merges remain with the owner. Work stops after each requested slice.

[Auth PR draft](docs/pr-drafts/0.2-auth-session.md) records validation and manual checks; [the foundation draft](docs/pr-drafts/0.1-project-foundation.md) records the initial scaffold. The supplied PDFs remain local design references: the Nirmaan book governs appearance; the SitePulse reference contributes interaction ideas only.
