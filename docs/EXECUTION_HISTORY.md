# Execution history: roadmap 3.4

Roadmap 3.4 replaces the Manager History placeholder with accepted execution records and their supporting evidence. It follows design-book page 7 and the production web history at source commit `564befbf589478ab9a1e123e4b9b72e5ee2b7026`. It adds no schema, policy, service-role access or replacement API.

## Production reads

| Purpose                | Existing contract              | Mobile validation                                                                                                                                                                                         |
| ---------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepted evidence      | `execution_history(p_project)` | Planner/manager authorization, at most 20,000 rows, UUID/date/timestamp shape, unique event and decision IDs, server order, duplicated evidence fields, correction target and effective-state consistency |
| Completed work context | `schedule_snapshot(p_project)` | Exact selected project, one coherent active revision and existing activity actuals                                                                                                                        |
| Access recheck         | `project_members`              | Same user, project, role and membership version after both RPC reads                                                                                                                                      |

All calls use the signed-in user's Supabase session. The database's planner check remains authoritative. A reporter or supervisor role is rejected before a history RPC, and membership is read again before results are exposed. Project switching removes every `execution-history` query so accepted evidence cannot carry into another project.

The RPC returns immutable accepted events in ascending acceptance order. Mobile validates this order, then presents newest records first. A record marked replaced must have one returned correction that points to the same activity and event kind. The duplicated `eventDate`/`quote` fields must exactly match the accepted facts. Missing or internally inconsistent data is treated as a changed read and never partially rendered.

The backend deliberately refuses an unscoped history above 20,000 events. Mobile preserves that boundary and tells the manager to use a scoped planner export. Building that export remains roadmap 5.1.

## Screen behavior

The screen follows the two-part reference structure:

- **Completed work** uses current accepted actual start and finish dates from the schedule snapshot. Selecting an activity filters its accepted evidence. Calendar-day spans are labeled as date spans and explicitly not presented as working duration or productivity.
- **Accepted field records** show activity/source IDs, event type and date, verbatim evidence, location, reviewer, acceptance time in IST, decision reason and current/replaced status. Audit expansion preserves the original report plus event, decision, audit, plan-revision, correction and accepted-facts references.

The production web-supported filters are preserved: up to 160 characters of search across activity ID/name, location, source ID, evidence and reason; discipline; current versus replaced evidence; and a selected completed activity. Results page locally at 20 records because the RPC is an intentionally bounded complete-history response. Filters and pages reset when the selected project changes.

Offline mode can show only a previously cached query and labels it as potentially stale. Refresh is disabled offline. Loading, no project, wrong role, empty result, revoked access, changed response, backend failure and prototype-limit states remain explicit.

## Verification boundary

Automated tests use synthetic records and a mocked Supabase transport. They cover the exact RPC payload, planner/manager authority, field-role rejection before network access, access recheck, malformed and duplicate records, mismatched schedule context, correction graphs, revoked/version-changed membership, prototype-limit mapping, filters, paging, screen states and audit disclosure.

Live production-RLS behavior still needs owner-designated planner and reporter records. This slice performs reads only, but those records may contain real field evidence and should be checked with an authorized test account on a physical device. No production data was read while implementing this slice.
