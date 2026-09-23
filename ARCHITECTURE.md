# ARCHITECTURE.md — System Diagrams (from the existing web app)

These are recreated from the web app's own architecture diagrams so Codex has
them as text/Mermaid instead of images. Mobile is a **new client** against
the **same backend** — nothing here changes; mobile just adds another arrow
into the same Supabase project.

## 1. Entity relationships

```mermaid
erDiagram
  PROJECTS ||--o{ PROJECT_MEMBERS : has
  PROJECTS ||--o{ SCHEDULE_IMPORTS : owns
  SCHEDULE_IMPORTS ||--o{ SCHEDULE_REVISIONS : generates
  SCHEDULE_REVISIONS ||--o{ SCHEDULE_NODES : contains
  SCHEDULE_NODES ||--o{ WBS_NODES : maps
  PROJECTS ||--o{ ACTIVITIES : contains
  ACTIVITIES ||--o{ ACTIVITY_PLAN_VERSIONS : versioned
  ACTIVITIES ||--o{ ACTIVITY_ACTUALS : tracks
  PROJECTS ||--o{ REPORTS : owns
  REPORTS ||--o{ REPORT_VERSIONS : versions
  REPORT_VERSIONS ||--o{ ATTACHMENTS : has
  ATTACHMENTS ||--o{ MEDIA_JOBS : queued
  ATTACHMENTS ||--o{ MEDIA_RESULTS : result
  REPORTS ||--o{ CLAIMS : yields
  CLAIMS ||--o{ ACCEPTED_EVENTS : accepted
  CLAIMS ||--o{ REVIEW_DECISIONS : reviewed
  PROJECTS ||--o{ PLANNER_EXPORTS : exports
```

## 2. Auth / read flow (mobile must replicate this exactly)

```mermaid
sequenceDiagram
  participant U as User (mobile)
  participant App as Expo App
  participant Auth as Supabase Auth
  participant DB as Postgres RLS/SQL
  U->>App: login / session
  App->>Auth: sign-in
  Auth-->>App: session JWT
  App->>DB: RPC / query with auth.uid()
  DB->>DB: check is_member / is_planner / can_read_report
  DB-->>App: authorized data or permission error
```

## 3. Write flow (report submission, claim decisions, exports)

```mermaid
sequenceDiagram
  participant App as Expo App
  participant SB as Supabase (.from()/.rpc())
  participant DB as Postgres SQL
  participant W as Worker (media processing)
  App->>SB: .from() / .rpc()
  SB->>DB: authorization + function call
  DB-->>SB: result / permission error
  SB-->>App: JSON response
  DB-->>W: job queue / media completion / accepted events
  W-->>DB: update media_results / claim states
```

Mobile never talks to the worker directly. It writes through Supabase, the
worker picks up queued jobs (`media_jobs`) asynchronously, and mobile learns
the outcome by re-reading `media_results` / report status (poll or Realtime
subscription — see `CODEX.md` §5 open questions).

## 4. Deployment (reference only — mobile doesn't run any of this)

```mermaid
flowchart LR
  Browser --> WebContainer[web container]
  Mobile[Expo mobile app] --> Supabase
  WebContainer --> Supabase[Supabase Postgres/Auth/Storage]
  WorkerContainer[worker container] --> Supabase
  WorkerContainer --> AI[External AI providers]
  Supabase --> Evidence[(Storage bucket: evidence)]
```

Web + worker run in Docker. Mobile is an additional client of the same
Supabase project — it uploads evidence to the same `evidence` bucket and is
subject to the same RLS policies as the web app; there is no separate mobile
backend to build.

## 5. What this means for the mobile build

- Every mobile screen maps to an existing table/RPC/API route — see
  `CODEX.md` §3 and `FEATURES.md`. If a screen needs something not
  listed there, stop and ask before inventing a backend contract.
- Auth must produce the same JWT / `auth.uid()` that RLS policies check —
  use Supabase Auth's mobile SDK flow, not a custom auth scheme.
- Anything async (media processing, claim verification) is eventually
  consistent from the mobile client's point of view — always show an
  explicit pending/processing state, never assume an immediate result.
