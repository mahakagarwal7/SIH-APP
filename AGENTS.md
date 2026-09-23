# AGENTS.md — Nirmaan Mobile (Codex Agent Instructions)

This file is read by the coding agent (Codex Astra) before any work in this repo.
Follow it exactly. Session-specific instructions from the human can override a
single task, but the defaults below always apply otherwise.

## 0. What you're building
Nirmaan Mobile is the React Native (Expo) companion to the existing Nirmaan web
app (Next.js + Supabase). It targets the two personas already defined in the
Nirmaan design book:

- **Field workers/supervisors** — report progress by voice/text/photo, view
  assigned tasks, drill into task hierarchy, track their own report status.
- **Planners/managers** — review pending decisions, check project health,
  verify claims, view execution history, on the go.

Read `CODEX.md` for product + data-model context and `docs/ARCHITECTURE.md`
for the system diagrams **before writing any code**. Read `docs/FEATURES.md`
and `docs/ROADMAP.md` before starting any feature slice.

## 1. Non-negotiable operating rules
1. **One step per session.** Never scaffold the whole app in one pass. Build
   only the single roadmap step named in the prompt (see `docs/ROADMAP.md`).
   Stop when that slice is done, tested, and documented — do not continue to
   the next step unprompted.
2. **Never `git push`. Never open a PR, issue, or touch a remote branch.**
   Local `git add`/`git commit` is fine when asked. Pushing to GitHub is
   always done manually by the human. If a task seems to require a remote
   action, stop and say so instead of doing it.
3. **No secrets in code.** Supabase URL/anon key are read from `.env` via
   `expo-constants`, never hardcoded. The service-role key must never exist
   in this repo at all.
4. **Every slice ships with tests** for the logic you add (unit tests for
   hooks/services at minimum) and must pass `npm run typecheck`,
   `npm run lint`, and `npm test` before you consider it done.
5. **Match the web app's existing contracts — don't invent new ones.** Table
   names, RPC function names, and API routes are fixed by the Supabase schema
   already in production (see `CODEX.md` §3). If a screen needs data that
   doesn't exist yet in that schema, say so instead of inventing a table.
6. **Follow `RULES.md`** for git/GitHub conventions (branching, commit
   messages, PR draft docs) even though you never push — history should
   already be clean when the human pushes it.
7. **Ask, don't assume**, when a design or data question is genuinely
   ambiguous (see the open questions in `CODEX.md` §7). Otherwise state your
   assumption in the commit message and proceed.

## 2. Stack
- Expo (managed workflow) + TypeScript + Expo Router
- `@supabase/supabase-js` — same Supabase project as the web app
- `@tanstack/react-query` for all server state/caching
- Zustand (or plain context) for local UI state only — server state always
  lives in React Query, never duplicated into local state
- Offline outbox: `expo-sqlite` (or AsyncStorage for the MVP) for queued
  field reports awaiting upload
- `expo-av`, `expo-image-picker`, `expo-file-system` for voice/photo capture
- `expo-secure-store` for auth tokens
- Testing: Jest + `@testing-library/react-native`
- Lint/format: ESLint + Prettier

## 3. Repo layout (target shape — build it incrementally, don't front-load)
```
app/                   # Expo Router routes (screens)
src/
  components/          # shared UI components
  features/            # one folder per feature: schedule, field-reports,
                        # claims, exports, projects
  lib/
    supabase.ts         # client init
    queryClient.ts
  hooks/
  types/                # types mirroring the Supabase schema
  offline/              # outbox/queue logic for offline report capture
docs/
  ARCHITECTURE.md
  FEATURES.md
  ROADMAP.md
  pr-drafts/             # PR description drafts, one per shipped slice
.github/
  workflows/ci.yml
  pull_request_template.md
AGENTS.md
CODEX.md
RULES.md
```
Don't create files outside this shape without a one-line reason in the commit
message.

## 4. Definition of done for any slice
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] New logic has tests, `npm test` passes
- [ ] No RLS/auth bypass — every Supabase call goes through the existing
      RPCs/policies, never a raw write that skips `is_member`/`is_planner`
- [ ] Screen matches the reference design (design book + mobile reference
      screens) in structure and states — loading, empty, error, offline
- [ ] Commits follow `RULES.md` conventional-commit format
- [ ] A PR draft note exists at `docs/pr-drafts/<slug>.md`: what was built,
      what was assumed, what's left, manual test steps for the human

## 5. What NOT to do
- Don't add a UI library or design system without checking the design book
  first — the visual language (navy, serif headings, restrained styling) is
  already defined.
- Don't build the schedule *import* UI on mobile (Feature 1) — that stays a
  desktop task; mobile only gets a read-only schedule view.
- Don't build push notifications or the Alerts screen until the human
  confirms scope (see `CODEX.md` §7).
- Don't touch GitHub remotely, ever, regardless of how the task is phrased.
