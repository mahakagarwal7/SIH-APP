# Nirmaan Mobile — repo setup kit

This is the pre-flight kit for a new repo, before any app code exists. Drop
these files at the root of a fresh repo, then hand build steps to Codex Astra
one at a time from `docs/ROADMAP.md`.

## Files in this kit
| File | Purpose |
|---|---|
| `AGENTS.md` | The rules Codex reads before any task — stack, repo shape, non-negotiables (no push, one step at a time, tests required). |
| `CODEX.md` | Product context: what Nirmaan is, the existing backend contracts (RPCs/tables/APIs) mobile must reuse, open questions to ask before assuming. |
| `RULES.md` | Git/GitHub conventions: branching, commit format, PR-draft hygiene, code-quality gates, security rules. |
| `docs/ARCHITECTURE.md` | The web app's ER diagram, auth flow, write flow, and deployment diagram, recreated as Mermaid so Codex has them as text. |
| `docs/FEATURES.md` | The 5 backend features scoped down to what mobile actually builds, with acceptance criteria per feature. |
| `docs/ROADMAP.md` | The step-by-step build order — one prompt per step, smallest first. |
| `.github/workflows/ci.yml` | Lint/typecheck/test gate on every push and PR. |
| `.github/pull_request_template.md` | Shape for PR descriptions (and the `docs/pr-drafts/*.md` Codex writes per step). |
| `.gitignore` | Expo/RN + secrets ignores. |

## How to use this
1. Create the new GitHub repo yourself (don't let the agent do it).
2. Copy this kit's contents into the repo root, commit as
   `chore: initial repo setup and agent context`, push it yourself.
3. Open Codex Astra in the repo. First prompt:
   > "Read AGENTS.md, CODEX.md, RULES.md, and everything in docs/. Then build
   > step 0.1 from docs/ROADMAP.md. Stop when the Definition of Done in
   > AGENTS.md §4 passes."
4. Review, test on a device/simulator, commit and push yourself.
5. Repeat with the next roadmap step (0.2, 0.3, 1.1, ...). Never ask for more
   than one step per prompt — that's the whole point of the roadmap being
   numbered this granularly.

## Ground rules baked into every file here
- **The agent never pushes, never opens a PR, never touches GitHub
  remotely.** You always do that step yourself.
- **One roadmap step per session.** No "build the whole app" prompts.
- **Every step ships tested**, lint-clean, type-checked, before it's handed
  back to you.
- **The backend is fixed.** Table names, RPC names, and API routes come from
  the existing Supabase schema — the mobile app is a new client, not a new
  backend. See `CODEX.md` §3 for the full mapping.

## Source material this kit was built from
- `Nirmaan-Website-and-Mobile-Design.pdf` — the web design book (12 pages):
  planner website + field PWA screens, design principles, prototype scope.
- `Untitled.pdf` — 8 mobile UX reference screens (voice reporting, task
  hierarchy, progress overview, alerts, manager panel) — used for
  interaction patterns only, not final branding.
- 5 architecture diagrams — auth/RLS sequence flow, API request flow, ER
  diagram, and deployment diagram — recreated as Mermaid in
  `docs/ARCHITECTURE.md`.
- The 5 feature specs (schedule import, field reporting, claim review,
  planner export, assignment/overview) mapped into `docs/FEATURES.md` and
  sequenced into `docs/ROADMAP.md`.
