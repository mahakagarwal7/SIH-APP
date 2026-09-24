# Manager review queue: roadmap 3.1

Roadmap 3.1 is a read-only mobile view of the production claim-review data. It uses the existing authenticated Supabase client and production RLS. It adds no schema, policy, API route or decision mutation. Accept, reject, clarification and verification commands remain roadmap 3.2.

## Source and contracts

The contract was checked against web source `564befbf589478ab9a1e123e4b9b72e5ee2b7026`, including the reports, clarification, follow-up and field-observation migrations; `packages/contracts/src/reports.ts`; and the planner review page and panel. This source check does not prove which migration revision is currently deployed.

| Read           | Existing contract                                                                         | Mobile use                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Queue          | `claims`, selected project, states `pending`, `clarification`, `verification`, `disputed` | Exact-count pages of 20 unresolved claims in stable claim-ID order                                |
| Evidence       | `reports`, version 1 from `report_versions`, received `attachments`                       | Original report text, captured audio/photo provenance and one-minute authenticated evidence links |
| Match context  | `candidate_matches`                                                                       | Ranked score, matcher features and mismatch reasons; RLS requires planner authority               |
| Activity label | `schedule_snapshot(p_project)`                                                            | Resolve a candidate to the active activity name and location when still available                 |
| Reporter label | `project_members`                                                                         | Display the report author's recorded project name                                                 |
| Access recheck | Active `project_members` row for the signed-in user and selected project                  | Reject removed, downgraded or version-changed manager access before publishing the page           |

`app_private.is_planner(project_id)` includes active `planner` and `manager` memberships. The screen checks that role before reading and the database remains authoritative. Client checks do not grant access.

## Behavior

- The queue shows only unresolved states used by the web filter. Terminal claim history belongs in the approved History slice.
- A card exposes the extracted evidence quote, date, location, stage, full or partial scope, quantity, qualifiers and validation flags. Missing values say `Not recorded`.
- Opening a card displays report version 1 as the original evidence. A claim produced by a later clarification still retains its own extracted evidence quote and version metadata.
- Captured transcripts and photo provenance come from the immutable version-1 context. Received attachment rows are read under RLS; a fresh one-minute storage URL is generated only after rechecking manager membership when the reviewer opens a file.
- A correction claim names the accepted event it would replace and states that the earlier event remains in history.
- Candidate reasons prefer explicit mismatch flags. With no mismatch, known positive matcher features are translated into plain labels. A score is displayed as a matcher score and never as construction completion.
- Activity labels come from the active schedule snapshot. A candidate from an earlier revision remains visible by ID and is explicitly marked as belonging to the report's earlier revision.
- Empty, loading, error, no-access, role-denied and offline states are separate. Previously loaded data may remain visible offline or after a transient refresh failure with a stale warning; a confirmed access denial hides the cached page. No review data is persisted to device storage.
- React Query keys contain account, project, membership version and page. Project switching cancels and removes the review namespace before the selected context changes.

## Completeness and consistency

The reader requires an exact queue count, one report and one original version for every claim, unique claim/candidate keys, no cross-project rows, at most eight candidates per claim, and a matching snapshot project. It then rechecks the selected membership and role.

These tables and the schedule RPC are separate RLS-protected reads. The checks reject observable incomplete or mixed-project results but cannot create a transactionally atomic snapshot. A claim can change immediately after the read; refresh obtains a new page. A coordinated backend snapshot would require a separately approved contract.

## Verification plan

Automated tests cover planner and manager authority, local role denial, stable server pagination, empty pages, permission errors, malformed/incomplete results, cross-project data, membership removal or downgrade, offline and UI states, verbatim source expansion, candidate reasons and page changes. Repository gates include strict typecheck, lint, formatting, the full Jest suite and Android/iOS/web exports.

Live RLS, real claim contents and device rendering require the local publishable key plus designated production test accounts. The app must use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; service-role and signing secrets never belong in this repository.
