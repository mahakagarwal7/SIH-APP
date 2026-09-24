# Read-only manager schedule: roadmap 4.1

Roadmap 4.1 replaces the Manager Schedule placeholder with a read-only view of the active production schedule. The contract was checked against web source `564befbf589478ab9a1e123e4b9b72e5ee2b7026`, its shared `ScheduleSnapshot` schema and the current `schedule_snapshot(p_project)` migration. Design-book page 3 guides the visual structure.

## Production boundary

Mobile calls the existing authenticated `schedule_snapshot(p_project)` RPC and then rechecks the selected `project_members` row. The selected user must remain an active planner or manager in the same project with the same membership version. A field role is rejected before the RPC. The database's existing RLS remains authoritative.

The parser preserves the complete snapshot fields used by the schedule:

- project, active revision label/ID, policy version and monotonic schedule version;
- all supported production disciplines and up to the import boundary of 2,500 nodes/activities;
- planned and original baseline dates, source hierarchy/context and calendar;
- accepted actual start/finish, quantity, percentage/basis, progress date and milestone occurrence;
- actuals version, reporter assignment and unresolved reported-progress indicator.

The reader rejects invalid calendar dates, reversed planned/baseline/actual ranges, accepted finishes without starts, inconsistent milestone occurrences, duplicate activity/node identifiers, cross-project/revision activities and a no-revision snapshot containing schedule rows. It rechecks access after parsing before exposing results.

No schedule import, activation, assignment or write control is added. Those remain web planner operations. Pending reports remain explicitly separate from accepted actuals.

## Mobile presentation

The active revision banner and schedule version make refresh changes visible. Revision or schedule-version changes reset discipline, page, baseline and expanded-record state so controls from an earlier snapshot cannot carry forward.

The list keeps the web-supported discipline and baseline controls. Each activity has a common-range Gantt-lite track for planned dates, optional original baseline and accepted actual interval/start; textual dates remain present for precision and accessibility. Cards preserve the web status distinctions: Not started, Progress reported · start unresolved, In progress and Complete.

Activity records expose source hierarchy/WBS, calendar, predecessors, baseline, accepted actuals, quantity, percentage/basis, progress date and milestone occurrence. Quantity and percentage remain separate from completion. Results page locally at 25 activities to keep the phone view bounded; the RPC itself is already limited by the production import boundary.

Offline mode shows only a previously cached snapshot and labels it as potentially stale. Loading, no project, wrong role, no active schedule, empty discipline, changed snapshot, revoked access and backend failure states are explicit.

## Verification boundary

Automated tests use a mocked Supabase transport and synthetic schedule rows. They cover the exact RPC payload, planner/manager authority, field-role rejection, access recheck, project/revision isolation, duplicate and malformed rows, date/milestone rules, no-schedule state, Gantt calculations, supported filters, baseline toggle, activity details, pagination, revision-state reset, offline labeling and error states.

No production data was read and no emulator or physical phone was used during implementation. Live RLS and cross-client comparison require an owner-designated project and account.
