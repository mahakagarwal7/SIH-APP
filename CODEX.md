# CODEX.md — Product & Data Context

Read this before touching any feature. It explains *what Nirmaan is*, *what
already exists on the backend*, and *what the mobile app's job is* relative
to that. Diagrams referenced here live in `docs/ARCHITECTURE.md`.

## 1. What Nirmaan is
Nirmaan is a "planning-to-execution bridge" for EPC/construction projects
(built for an SIH problem statement, Oil India Limited theme; project and
personnel data are fictional). The existing product has two surfaces:

- **Planner website** (Next.js) — schedule import/Gantt, a review queue for
  field reports, execution history, planner exports.
- **Field PWA** (also Next.js, mobile web) — voice/text/photo progress
  reporting, "my work", "my reports", explicit offline/sync states.

**Nirmaan Mobile is a native (Expo) rebuild of the field PWA, plus a
lightweight manager/planner view**, so both personas can work from a phone
instead of a browser tab.

## 2. Design language to preserve
From the Nirmaan design book: formal, record-focused; navy + serif headings
for structure, sans-serif for data tables. Three product principles the
design book calls out explicitly — carry them into every mobile screen:

1. **Quantity ≠ completion.** Always show partial progress like "2 of 8
   spools accepted", never collapse it into a single misleading percentage.
2. **Honest states.** A missing date or value is shown as "Not recorded", not
   hidden, not defaulted to zero or "now".
3. **Delivery state is three-way.** *Saved on device → Sent for review →
   Accepted* are three distinct, always-visible states — never collapse
   "sent" and "accepted" into one green checkmark.

The second uploaded reference (8 phone mockups, labelled "SitePulse") is a
**UX/interaction reference only** — it shows the voice-reporting flow, task
hierarchy drill-down, a progress donut, an alerts list, and a manager panel.
Rebrand all of it to Nirmaan. Do not ship the "SitePulse" name, and where its
visual style conflicts with the Nirmaan design book (§2 above), the design
book wins.

## 3. Backend contracts — already exist, do not redesign
Mobile talks to the **same Supabase project** as the web app. Auth is
Supabase Auth (JWT); all data access goes through Postgres RLS keyed on
`auth.uid()`, enforced by policies like `is_member`, `is_planner`,
`can_read_report`. See `docs/ARCHITECTURE.md` §2 for the request flow.

### Feature 1 — Schedule import & activation
- RPCs: `public.reserve_schedule_import(...)`, `public.activate_schedule_revision(...)`
- Tables: `schedule_imports`, `schedule_revisions`, `schedule_nodes`,
  `wbs_nodes`, `activities`, `activity_plan_versions`
- **Mobile scope: read-only.** A schedule/Gantt-lite view plus "revision
  activated" status banner. Import stays a desktop task (large file upload) —
  do not build import UI unless explicitly asked.

### Feature 2 — Field reporting with media (core mobile feature, build first)
- RPCs: `reserve_field_capture(...)`, `finalize_field_media(...)`,
  `lease_field_media()`, `complete_field_media(...)`, `submit_field_capture(...)`
- Tables: `public.attachments`, `public.media_jobs`, `public.media_results`,
  `public.report_versions`, `public.reports`
- **Mobile scope:** capture voice/photo/text → save locally → upload →
  `reserve_field_capture` / `finalize_field_media` → `submit_field_capture`.
  Poll (or subscribe via Supabase Realtime) for `media_results` / report
  status so the app reflects accepted/rejected once the worker finishes.

### Feature 3 — Claim review & verification (manager persona)
- API: `/api/v1/claims/[claimId]/verifications`,
  `/api/v1/verifications/[requestId]/decisions`
- Tables: `accepted_events`, `review_decisions`, `claims`
- **Mobile scope:** review queue list + a decision screen (accept/reject with
  reason), a phone-sized version of the web "Review before acceptance" flow.

### Feature 4 — Planner export generation
- API: `/api/v1/projects/[projectId]/exports`, RPC
  `public.create_planner_export(...)`
- Tables: `public.planner_exports` (+ file manifest/hash)
- **Mobile scope: low priority.** Trigger an export and show its
  status/download link. Generation itself stays server-side.

### Feature 5 — Assignment & project overview
- Routes: `/api/projects/[projectId]/assignments`, project list routes
- Tables: `project_members`, `activities`, schedule nodes, assignments
- **Mobile scope:** project switcher, "my work" home screen, manager overview
  cards.

## 4. Deployment context (for reference — mobile does not run any of this)
Web + worker run in Docker: a web container and a worker container both talk
to Supabase Postgres/Auth/Storage; the worker also calls external AI
providers to process audio/photo evidence and writes results back. Mobile is
a client only — it talks to the same Supabase project over the network,
never to the worker directly, and uploads evidence to the same `evidence`
storage bucket the web app uses. See `docs/ARCHITECTURE.md` §4.

## 5. Open questions — ask the human, don't guess
- Exact Supabase project URL/keys, and staging vs. production project.
- Whether mobile ships push notifications / the "Alerts & Approvals" screen —
  it appears in the UX reference screens but is not one of the 5 confirmed
  features. Confirm scope before building it.
- Target languages: the Nirmaan design book shows Hindi/English; the UX
  reference screens also show Tamil. Confirm which languages ship in v1.
- Realtime vs. polling for report/claim status updates — confirm Supabase
  Realtime is enabled on the relevant tables before relying on it.
