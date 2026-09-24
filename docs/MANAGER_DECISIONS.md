# Manager decisions: roadmap 3.2

Roadmap 3.2 turns an unresolved claim into an explicit manager action. It uses the existing authenticated production Supabase business RPCs and their database authorization checks. It adds no schema, policy, service-role access or replacement API.

## Transport decision

The roadmap names the web routes under `/api/v1/claims` and `/api/v1/verifications`. Current web source `564befbf589478ab9a1e123e4b9b72e5ee2b7026` confirms those Next.js handlers require a browser Supabase cookie and reject non-same-origin requests. A native Supabase access token cannot be treated as that cookie session.

The owner-approved delivery plan's D5 extension authorizes existing authenticated Supabase reads and business RPCs under production RLS for the mobile flows, with no replacement web API. Mobile therefore calls the same functions used by those routes:

| Mobile operation              | Existing production function                                                                                                 | Required behavior                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Load current decision context | `claims`, `reports`, `report_versions`, `candidate_matches`, `verification_requests`, `project_members`, `schedule_snapshot` | Recheck planner/manager membership, claim version, active revision, policy, actuals and any active verification   |
| Preview acceptance            | `preview_claim(p_command)`                                                                                                   | Return exact before/after actuals plus a hash; write nothing                                                      |
| Accept or reject              | `decide_claim(p_command)`                                                                                                    | Require the expected versions, reason and unchanged preview hash for acceptance; record the decision idempotently |
| Ask the reporter              | `request_clarification(p_claim, p_command)`                                                                                  | Open one typed question without accepting work                                                                    |
| Ask an independent supervisor | `request_verification(p_claim, p_command)`                                                                                   | Route the exact claim/activity to an eligible verifier without accepting work                                     |

All RPCs use the mobile user's Supabase session. Database `app_private.is_planner` and the function-specific checks remain authoritative.

## Deliberate acceptance

- The manager must select a specific current-revision candidate. The top-ranked candidate is never selected automatically.
- Mismatch flags or unresolved validation flags block acceptance. A missing work date can be supplied as a real calendar date through the contract's `correctedDate` field.
- The preview command includes claim, report, processing run, plan revision, policy and activity-actuals versions. The screen displays before and after actual start, finish, accepted quantity with its unit, accepted progress, basis, milestone date and progress date.
- Acceptance reuses the exact preview command ID and adds the returned `previewHash`. Changed inputs discard the visible preview. A changed claim, actuals row or preview hash is refreshed instead of silently retried with new facts.
- Quantity and percentage remain evidence fields. The screen never treats either as automatic activity completion.

## Other outcomes

- Reject requires a written reason and records no accepted schedule change.
- Clarification asks one of the backend-supported question types: location, date, scope, assignment or another unfinished detail.
- Verification requires a deliberate activity and reason. It remains independent evidence; the claim can be accepted only after the assigned verifier confirms both allocation and work. A manager may request another verification after a denial, as allowed by the existing function.
- Reporter answers and supervisor attestation screens remain the separately planned clarification/supervisor-response slice.

## Idempotency and cache behavior

Each action holds one command ID while its complete payload is unchanged. A retry after a lost response sends the same ID and payload so the database can replay the recorded result. Changing any decision field creates a new command ID.

After an accepted or rejected result, the claim is removed from every cached page for the same account and project and every cached total is decremented once. Other projects remain untouched. Clarification and verification keep the claim in the queue and invalidate its current server state.

## Consistency boundary

The context reader rejects malformed, incomplete, duplicate or cross-project results; changed plan/policy versions; multiple active verifications; and membership or claim changes observed during the read. These remain separate RLS-protected requests, so database mutations still perform the final authoritative version checks. The client maps known stale, authorization and validation errors to reviewed messages and does not expose database detail.

## Verification plan

Automated tests cover planner/manager authority, field-role rejection before network access, production-only Supabase RPC transport, exact version inputs, calendar dates, candidate selection, before/after preview, preview-hash acceptance, reasoned rejection, clarification/verification separation, stale refresh, stable retry IDs, offline blocking and project-scoped queue updates. Live production checks require designated test claims because acceptance and rejection are durable business records.
