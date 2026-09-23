# Nirmaan Mobile

The Expo companion to [IntelliGrid](https://intelligrid-sih122.vercel.app), using the existing production Supabase backend. The owner confirmed **Nirmaan** as the mobile name on 23 September 2026.

Roadmap **0.1** provides the application foundation and a minimal launch screen. Authentication, project data, reporting, offline delivery and manager features remain later slices.

## Run locally

Use the Node version in `.node-version` (22.19.0), then:

```sh
npm ci
npm start
```

Use `npm run android` with a compatible Android emulator or device, or `npm run web` for a browser preview. This slice has no backend calls and starts without environment values. Browser and Metro export checks do not prove installation or operation on a physical device.

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

The separate web checkout uses `apps/web/.env.local` with exactly:

```dotenv
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=<supplied locally>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key supplied locally>
```

The web checkout is `C:\Users\Mahak\SIH-122`. The local file has the owner-supplied URL; its publishable key still needs to be filled locally from the Supabase dashboard. The mobile `.env.example` reserves those same public variable names for step 0.2. Runtime configuration through Expo Constants and authentication are not implemented in 0.1. Do not add a service-role key, password or signing key.

## Project layout

- `app/`: Expo Router entry and launch route.
- `src/components/`: launch screen and its test.
- `docs/`: decisions, workflow and PR drafts.
- `.github/workflows/ci.yml`: required checks.

Feature folders are added when their roadmap slice needs them.

## Project references

Read [AGENTS.md](AGENTS.md), [CODEX.md](CODEX.md), [RULES.md](RULES.md), [architecture](ARCHITECTURE.md), [features](FEATURES.md) and [roadmap](ROADMAP.md) before implementation.

The [project review](docs/PROJECT_REVIEW.md) records verified backend contracts and unresolved decisions. The [development workflow](docs/DEVELOPMENT_WORKFLOW.md) supersedes the historical prohibitions on remote actions: signed commits, pushes and feature PRs are authorized; merges remain with the owner. Work stops after each requested slice.

[Foundation PR draft](docs/pr-drafts/0.1-project-foundation.md) records validation and manual checks. The supplied PDFs remain local design references: the Nirmaan book governs appearance; the SitePulse reference contributes interaction ideas only.
