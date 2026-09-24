# Clarification and verification responses: roadmap 3.3

Roadmap 3.3 completes the mobile response half of the existing production follow-up workflow. [Companion backend PR #8](https://github.com/ShivenduShivu/SIH122/pull/8) supplies assignment freshness to mobile through an additive RPC while preserving the existing web RPC contract; it adds no table, column, policy, service-role access or worker call.

## Production contract

Current web source `564befbf589478ab9a1e123e4b9b72e5ee2b7026` defines browser-cookie, same-origin POST routes for these actions. The approved delivery plan's D5 extension permits the native client to call the same authenticated business functions directly under production RLS:

| Mobile operation          | Existing production contract                                                                                            | Authority and stale boundary                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load reporter questions   | `reports`, `report_versions`, `claims`, `clarification_requests`, `clarification_responses`                             | The signed-in user must still be the report author and an active project member. At most one question may be open for a claim workflow.                        |
| Answer a question         | `respond_clarification(p_question, p_command)`                                                                          | The database checks reporter ownership, open question/version, claim/version/state and submitted report lifecycle.                                             |
| Load supervisor checks    | `verification_requests`, `verification_decisions`, `verification_context_v2(p_project)`, `schedule_snapshot(p_project)` | Rows are filtered to the signed-in routed verifier; the API reports whether the immutable assignment version is still current even when RLS hides a later row. |
| Record a supervisor check | `decide_verification(p_request, p_command)`                                                                             | The database checks routed verifier eligibility, request/claim/report/revision/policy/assignment/facts versions and the current verification state.            |

Each write retains one command ID while its complete payload is unchanged. A retry after an unknown network result therefore asks PostgreSQL to replay the same recorded command. Changing any field creates a new ID.

## Reporter behavior

My Reports opens a server-submitted report detail containing the verbatim original source, current claim states, validation flags, question history and recorded answers. The backend permits one open question per claim, so when different claims need clarification the mobile screen presents them sequentially. The current question uses the backend's structured fields:

- location: choose up to eight permitted activity areas or type one other location, never both;
- date: enter a real `YYYY-MM-DD` calendar date;
- scope: confirm whole activity or partial work, preserving unfinished wording;
- assignment: confirm the location and identify who assigned the work;
- detail: record the other missing fact;
- uncertain: **Not sure** remains an explicit supported answer.

A stale or failed response refreshes current state without clearing entered text. After a successful response, the entered reply is cleared before the next queued question appears. Every success message states that the answer creates review evidence and does not approve progress.

## Supervisor behavior

Supervisors, planners and managers can open **Supervisor checks** from My Work. The list contains only checks routed to that signed-in user for the selected project. The detail screen shows the reporter, exact source, extracted evidence, work date, activity and earlier checks. Before enabling a write, mobile confirms the claim version and state, report lifecycle, active revision and policy version. The versioned context RPC compares the request's assignment version against the latest immutable assignment version under server authority, so a later row hidden from the former verifier still makes the request read-only. The write RPC repeats the assignment check transactionally. If any part changed, mobile keeps the history visible and disables the write; when the schedule revision changed, it also omits current-revision activity details.

The new `verification_context_v2` RPC keeps the original `verification_context` endpoint intact for existing web clients. It uses the same `can_read_verification` eligibility predicate and returns only requests the signed-in user can already inspect; its added boolean reveals only whether that request's assignment version is current.

The verifier must answer assignment authority and exact reported work/date separately with **Confirm**, **Cannot confirm** or **Need details**, then record a reason. Confirming both returns the claim to pending planner review; denial disputes it; a needs-information result keeps verification open. None of these outcomes accepts schedule progress.

## Consistency and recovery

Client reads page complete histories in stable order, checking exact counts and rejecting malformed, duplicate, cross-project or cross-account results, changed report/membership context, duplicate open questions for one claim, stale open-question claim snapshots, inconsistent decision history and missing evidence. An open question remains tied to its claim's immutable report-version snapshot even when a reply on another claim advances the report's global version. Pages and ID batches are bounded at 10,000 rows. These are separate RLS-protected reads, so the two database functions remain the final transactional authority.

The mobile cache refreshes My Reports, recent reports, manager review and decision context after a response. Project changes clear cached supervisor assignments. Cached screens are read-only offline; focus changes do not trigger network refreshes, and the client never submits clarification or supervisor writes until the connection returns. If a refresh replaces a question, its unsent draft remains visible beside that original question, clearly labeled as unsent.

An open clarification is checked against its own immutable claim version and report snapshot. A reply to a different claim can advance the report's global current version while this question remains open; that does not make its snapshot stale. The client still verifies the report and membership did not change during the read, and the database remains the final authority when a reply is submitted.

## Verification plan

Automated tests cover structured reply rules, real calendar dates, reporter ownership, complete question history, routed verifier/project isolation, exact evidence context, both attestation checks, idempotent RPC payloads, stale recovery, retained input, report-detail entry and supervisor-check navigation. Live checks require owner-designated production reporters, claims and supervisors because these functions create durable audit records and new processing work.
