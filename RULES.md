# RULES.md — Contribution & Git Rules

## 1. The rule that overrides everything else
**Never run `git push`. Never create or update a GitHub PR, issue, release,
or remote branch. Never call a GitHub-writing API/tool.** All remote actions
are done manually by the repo owner. Local `git add` / `git commit` is fine
so history is clean when they push — but nothing leaves the machine through
you.

## 2. Branching
- `main` is protected. Never commit directly to it, even locally — always
  work on a feature branch.
- Branch naming: `feature/<roadmap-step>-<short-slug>`, e.g.
  `feature/1.2-voice-report-capture` (step numbers come from
  `docs/ROADMAP.md`).
- One branch per roadmap step. Don't mix unrelated steps on one branch.

## 3. Commits — Conventional Commits, strictly
```
<type>(<scope>): <short summary>

<body — what changed and why, 1-4 sentences>

<footer — Refs: ROADMAP-1.2 / BREAKING CHANGE: ...>
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
Scope: the feature folder (`schedule`, `field-reports`, `claims`, `exports`,
`projects`, `offline`, `ui`, `auth`).
Keep commits small and atomic — one logical change per commit, never one
giant commit per roadmap step.

## 4. Pull request hygiene (prepare it, don't open it)
Every roadmap step ends with a PR description saved to
`docs/pr-drafts/<step-slug>.md`:
- Summary of what was built
- Screens/flows covered vs. still open
- Assumptions made (and why)
- Test coverage added
- Manual test steps the human should run on-device before pushing/merging

Use `.github/pull_request_template.md` as the shape for that draft.

## 5. Code quality gates — must pass before a step is "done"
- `npm run typecheck` — TypeScript strict mode; no `any` without a
  `// TODO(reason): ...` comment justifying it
- `npm run lint` — ESLint clean (no unused vars, no stray `console.log`,
  import order enforced)
- `npm run format:check` — Prettier clean
- `npm test` — Jest passes; new services/hooks get unit tests, pure
  presentational components don't strictly need them
- Any new dependency gets a one-line justification in the commit message

## 6. Security / data rules
- All Supabase access goes through the typed client in
  `src/lib/supabase.ts` — never construct raw SQL from user input.
- Never embed a service-role key on-device, ever. Only the anon key, scoped
  by RLS, belongs in the mobile bundle.
- Auth tokens live in `expo-secure-store`, never `AsyncStorage`.
- Cached evidence media (photos/voice) in the offline outbox is cleared as
  soon as it syncs successfully — don't retain it longer than needed.
- `.env`, `.env.local`, `*.key`, `*.pem` are gitignored — check before every
  commit that none are staged.

## 7. GitHub repo settings the human should enable manually
(The agent documents these; it does not and cannot configure them.)
- Branch protection on `main`: require PR + passing `ci.yml` status checks,
  require review (self-review checklist is fine solo), disallow force-push
  and direct pushes.
- Secret scanning and Dependabot alerts turned on.
- `CODEOWNERS` optional for a solo project.

## 8. Definition of "ready to hand back to the human"
A step is ready when: tests pass locally, lint/typecheck are clean, commits
are conventional and atomic, a PR draft doc exists at
`docs/pr-drafts/<step-slug>.md`, and the agent's final message lists exactly
what to manually verify on a device/simulator before the human pushes.
