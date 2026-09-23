> Workflow update — 23 September 2026: the owner explicitly authorized signed
> commits, pushes and PRs in this mobile repository, major features through PRs,
> and small fixes/features directly to main where repository rules permit.
> This supersedes conflicting historical remote-action rules below. Use the
> owner's GPG signature and no assistant co-author trailers. Do not merge PRs
> or decide unresolved product/architecture questions without the owner's input.
> Work remains incremental; automatic continuation between slices is pending.
> See [the development workflow](docs/DEVELOPMENT_WORKFLOW.md) and
> [the project review](docs/PROJECT_REVIEW.md).

# ROADMAP.md — Build Order (one prompt per step)

Give these to Codex Astra **one step at a time**. Wait for a step to pass its
Definition of Done (`AGENTS.md` §4), review and test it yourself on a
device/simulator, manually `git commit`/push, _then_ start the next step.
Never ask for more than one step in a single prompt.

Suggested prompt shape for each step:

> "Build step **X.Y** from `ROADMAP.md`. Follow `AGENTS.md`, `CODEX.md`,
> and `RULES.md`. Stop once the Definition of Done checklist passes — don't
> continue to the next step."

---

## Phase 0 — Scaffold (once)

- **0.1** Init Expo + TypeScript project, ESLint/Prettier config, Jest setup,
  folder structure from `AGENTS.md` §3, `.env.example`, CI workflow
  skeleton. Deliverable: a running "Hello Nirmaan" screen and a green CI run.
  No features yet.
- **0.2** Add the Supabase client (`src/lib/supabase.ts`), sign-in screen,
  secure token storage (`expo-secure-store`), and session restore on app
  launch — matching the auth flow in `ARCHITECTURE.md` §2. No feature
  screens yet.
- **0.3** Add the navigation shell (Expo Router): two persona entry points
  (Field / Manager) and a project-switcher stub, bottom tabs matching the
  reference pattern (Home / Report / Tasks / Alerts / Profile). Screens can
  be empty placeholders.

## Phase 1 — Feature 2: Field reporting with media (build first)

- **1.1** Read-only "My work" task list for the signed-in field user.
- **1.2** Voice report capture screen (record → local save only, no submit).
- **1.3** Text and photo report capture screens, same local-save pattern.
- **1.4** Confirmation ("is this correct?") screen: transcript/caption, work
  date, suggested activity match, explicit partial-work flag.
- **1.5** Offline outbox + "My Reports" screen: Saved on device / Awaiting
  review / Accepted states; sync-on-reconnect via `reserve_field_capture` →
  `finalize_field_media` → `submit_field_capture`.
- **1.6** Status polling/subscription so report state updates once
  `media_results` changes after the worker finishes processing.

## Phase 2 — Feature 5: Assignment & project overview

- **2.1** Real project switcher (`project_members`-backed) + Home "current
  assignment" card.
- **2.2** Task hierarchy drill-down (milestone → WBS → activity → field
  task), read-only.

## Phase 3 — Feature 3: Claim review & verification (manager persona)

- **3.1** Review queue list screen (pending claims).
- **3.2** Decision screen (accept/reject + reason), wired to the
  verifications/decisions API.

## Phase 4 — Feature 1: Schedule (read-only)

- **4.1** Schedule/Gantt-lite list view + active-revision status banner.

## Phase 5 — Feature 4: Planner export

- **5.1** Export trigger + status/link screen. Build last, or skip if
  time-constrained — this is the lowest-priority feature.

## Phase 6 — Manager panel polish

- **6.1** Progress overview (completion-by-discipline bars + weekly trend),
  backed by real aggregates, mirroring the reference "Progress Overview"
  screen.
- **6.2** Alerts & approvals list — **confirm scope with the human first**
  (see `CODEX.md` §5 open questions) before building this; it's not one of
  the 5 confirmed backend features.

---

## After every step

1. Agent reports: what was built, what was assumed, what's left, and exact
   manual test steps.
2. Human tests on-device/simulator.
3. Human reviews the PR draft at `docs/pr-drafts/<step-slug>.md`.
4. Human manually commits (if not already) and pushes / opens the PR.
5. Only then does the next roadmap step get handed to the agent.
