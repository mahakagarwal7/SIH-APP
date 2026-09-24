# Clarification and verification responses: roadmap 3.3

Roadmap 3.3 completes the mobile response half of the existing production follow-up workflow. It adds no schema, policy, service-role access, worker call or replacement API.

## Production contract

Current web source `564befbf589478ab9a1e123e4b9b72e5ee2b7026` defines browser-cookie, same-origin POST routes for these actions. The approved delivery plan's D5 extension permits the native client to call the same authenticated business functions directly under production RLS:

| Mobile operation          | Existing production contract                                                                                         | Authority and stale boundary                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load reporter questions   | `reports`, `report_versions`, `claims`, `clarification_requests`, `clarification_responses`                          | The signed-in user must still be the report author and an active project member. At most one question may be open for a claim workflow.             |
| Answer a question         | `respond_clarification(p_question, p_command)`                                                                       | The database checks reporter ownership, open question/version, claim/version/state and submitted report lifecycle.                                  |
| Load supervisor checks    | `verification_requests`, `verification_decisions`, `verification_context(p_project)`, `schedule_snapshot(p_project)` | Rows are filtered to the signed-in routed verifier in the selected project; RLS rechecks independent scoped eligibility.                            |
| Record a supervisor check | `decide_verification(p_request, p_command)`                                                                          | The database checks routed verifier eligibility, request/claim/report/revision/policy/assignment/facts versions and the current verification state. |

Each write retains one command ID while its complete payload is unchanged. A retry after an unknown network result therefore asks PostgreSQL to replay the same recorded command. Changing any field creates a new ID.

## Reporter behavior

My Reports opens a server-submitted report detail containing the verbatim original source, current claim states, validation flags, question history and recorded answers. The current question uses the backend's structured fields:

- location: choose up to eight permitted activity areas or type one other location, never both;
- date: enter a real `YYYY-MM-DD` calendar date;
- scope: confirm whole activity or partial work, preserving unfinished wording;
- assignment: confirm the location and identify who assigned the work;
- detail: record the other missing fact;
- uncertain: **Not sure** remains an explicit supported answer.

A stale response refreshes the current question without clearing entered text. Every success message states that the answer creates review evidence and does not approve progress.

## Supervisor behavior

Supervisors, planners and managers can open **Supervisor checks** from My Work. The list contains only checks routed to that signed-in user for the selected project. The detail screen shows the reporter, exact source, extracted evidence, work date, activity and earlier checks.

The verifier must answer assignment authority and exact reported work/date separately with **Confirm**, **Cannot confirm** or **Need details**, then record a reason. Confirming both returns the claim to pending planner review; denial disputes it; a needs-information result keeps verification open. None of these outcomes accepts schedule progress.

## Consistency and recovery

Client reads reject malformed, incomplete, duplicate, cross-project or cross-account results, changed report/membership context, multiple open questions, missing exact report versions and missing verification reporter context. These are separate RLS-protected reads, so the two database functions remain the final transactional authority.

The mobile cache refreshes My Reports, recent reports, manager review and decision context after a response. Project changes clear cached supervisor assignments. Offline screens remain read-only and preserve any text already entered during a stale or failed write.

## Verification plan

Automated tests cover structured reply rules, real calendar dates, reporter ownership, complete question history, routed verifier/project isolation, exact evidence context, both attestation checks, idempotent RPC payloads, stale recovery, retained input, report-detail entry and supervisor-check navigation. Live checks require owner-designated production reporters, claims and supervisors because these functions create durable audit records and new processing work.
