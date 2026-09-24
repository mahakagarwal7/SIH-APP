# Project selection and Field Home contract

Roadmap 2.1 uses the production `project_members` and `projects` tables through the authenticated Supabase client and their existing RLS policies. It does not add a table, RPC, API route or write to the production backend.

## Online selection

1. Read up to 100 active `project_members` rows for the signed-in user, ordered by `project_id`.
2. Read exactly those project names from `projects` and reject missing, duplicate, cross-account or inactive results.
3. Keep the locally selected project when its project ID remains in the current membership result. Otherwise select the first membership in the established ordering.
4. Persist the selected membership and project metadata in the app-private SQLite database under the exact user ID.

An online membership result is authoritative. When a selected membership disappears, the app falls back to another current membership. When no membership remains, it deletes the remembered selection. A project change cancels and removes `my-work` and project-recent-report query caches before exposing the new selection.

## Offline and account boundaries

The remembered context is available only to the same signed-in user and only while the auth layer reports the device offline. It supplies the selected project name and permits an offline capture to retain the project it belongs to. It does not manufacture schedule or report data and cannot override an online access denial. The session-keyed React Query provider clears all in-memory server data on logout or account change.

## Field Home

Home uses the same selected context as the header, My work and report capture. Current assignments come from the existing `schedule_snapshot` RPC plus validated `assignment_versions`; Home displays the current assignment period without treating an earlier assignment as complete. Recent report context is scoped to the selected project. Native builds combine app-private drafts/outbox rows with production report status; web builds show production status only.

## Remaining acceptance

Production acceptance needs the local publishable key, designated multi-project/revoked-membership test accounts and a connected phone. Verify selection across restart, offline launch, logout/account change and live membership removal before merging.
