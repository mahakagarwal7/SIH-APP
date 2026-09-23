# My work: roadmap 1.1

On 23 September 2026, the owner approved existing authenticated Supabase queries/RPCs under RLS for step 1.1 (decision D5). This slice is read-only and uses the selected production project through local public configuration. It adds no schema, policy, web API or worker changes.

## Source and scope

Contracts were checked against the reviewed web source at `c779472cced97006856cfc186c955f69ad7d15ab`: `apps/web/src/lib/project.ts`, `apps/web/src/lib/read-rows.ts`, `apps/web/src/app/field/work/page.tsx`, `apps/web/src/components/work-card.tsx`, `packages/contracts/src/{index,reports}.ts`, and the project-foundation and field-observation SQL migrations. This is source evidence, not proof of the deployed migration state. Nirmaan design-book page 8 supplies the assigned-work layout.

| Read               | Existing contract                                                                                     | Use                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Default membership | `project_members`, `user_id = signed-in user`, `active = true`, ordered by `project_id`, first row    | Matches the web fallback before a project has been selected                                 |
| Project name       | `projects`, membership's `project_id`                                                                 | Display the authorized context in the header and work screen                                |
| Current schedule   | `schedule_snapshot(p_project)`                                                                        | Active-revision activities, current assigned reporter, accepted quantities and actual dates |
| Assignment dates   | `assignment_versions`, filtered by project, ordered by activity then descending version, pages of 200 | Select the latest visible assignment version and its effective dates                        |
| Access recheck     | Active `project_members` row for the same user/project                                                | Reject revoked or version-changed membership before publishing work                         |

The native client uses its existing user session. RPC authorization and table RLS remain the authority. Client filtering is only presentation. Field/Manager workspace selection does not assign a role.

## Behavior

- Show the first active project by ID and label it Default project. Do not imply it is the user's web cookie selection. Full project selection and the Home assignment card remain step 2.1.
- Match the web's `assignedReporterId === user.id` rule. A supervisor's broader read permission does not make another reporter's assignments their personal work.
- Reduce assignment versions before date grouping. Today includes both effective-date boundaries; Up next and Earlier assignments use the latest assignment's dates. Use India Standard Time, matching the web, regardless of phone timezone.
- Preserve exact accepted quantities, including a real zero. Missing plan quantity, unit, or actual dates remain explicit. Quantity never implies completion. Actual finish determines Complete; actual start determines In progress; reported progress without an accepted start stays distinct.
- Show loading, no active membership, no active schedule, no assignments, refresh/error and offline states separately. Hide old work after a failed or denied read. A prior in-memory result may remain visible offline with an explicit stale-data message.
- React Query owns server data. Cache keys contain user/project/membership version; changing or losing the session replaces the cache and cancels reads. No task data is persisted to device storage in this slice.
- Refresh on screen focus, app resume/reconnect and explicit Refresh. Midnight regrouping updates the displayed date without polling the backend. This is not the report-status polling decision D11.

## Completeness and consistency

Require exact counts while paging; reject changed counts, repeated keys, missing pages, malformed fields and the existing web reader's 10,000-row limit. Never display a partial read as a complete assignment list. Validate snapshot project/revision identifiers and require compatible assignment details for every displayed activity.

The existing snapshot RPC and assignment queries are separate reads. These checks detect observable inconsistencies but cannot guarantee a transactionally atomic snapshot across those requests. Future stronger consistency would need an explicitly coordinated backend contract; this slice does not invent one. Offline data cannot establish that access has not since been revoked.

## Verification plan

Test latest-version reduction, reassignment, date boundaries and IST rollover; stable paging and errors; malformed/mismatched snapshots; no membership and revoked membership; empty and no-schedule states; accepted quantity without inferred completion; reconnect and retry; account change with an in-flight request. Run typecheck, lint, formatting, all tests and Android/iOS/web exports. Inspect the mocked browser flow at phone widths against page 8. Live RLS and native-device behavior require separately recorded checks.

React Query lifecycle wiring follows its [React Native guidance](https://tanstack.com/query/latest/docs/framework/react/react-native) and [query cancellation contract](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation). Zod validates the consumed backend fields using its [schema API](https://zod.dev/api). These are the two added direct dependencies; no UI or native library is added.
