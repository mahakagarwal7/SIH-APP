# Manager overview aggregate boundary

Roadmap 6.1 replaces the Manager Overview placeholder with a read-only summary
of decisions waiting for action and accepted execution. It follows the Nirmaan
design-book execution overview and uses the mobile Progress Overview only as an
interaction reference.

## Production sources

The screen reads three existing authenticated, RLS-protected sources for the
selected project:

- `schedule_snapshot(p_project)` supplies the active revision, schedule version
  and accepted activity actuals;
- `execution_history(p_project)` supplies accepted evidence and correction
  status;
- actionable `claims` in `pending`, `clarification`, `verification` or
  `disputed` state supply an exact count and a five-item attention preview.

Only active planners and managers may start these reads. The client validates
each payload, rejects cross-project or incomplete attention pages, and rechecks
the same `project_members` row, role and membership version after all sources
load. Project switching clears the overview cache.

## Defined measures

- **Planned activities** is the number of reportable activities in the active
  schedule snapshot.
- **Completed activities** have an accepted `actualFinish`.
- **In progress** activities have an accepted `actualStart` and no accepted
  finish.
- **Reported progress without a start** is shown separately and never counted
  as started or complete.
- **Claims needing action** is the exact count returned by the actionable
  claims query. It counts claims, not distinct reports.
- **Discipline completion** is completed activity count divided by planned
  activity count within that discipline. The numerator and denominator remain
  visible beside the bar.
- **Weekly accepted field events** counts current effective history events by
  their recorded work date in Monday-to-Sunday site weeks. Replaced evidence is
  excluded. This is evidence volume, not productivity.
- **Recent accepted records** are the five newest effective events by acceptance
  time and retain their activity, evidence quote and reviewer context.

The screen deliberately has no overall completion percentage, weighted health
score, schedule variance claim, productivity rate, cost forecast or inferred
status. Those measures require an agreed weighting/denominator or a new backend
contract.

## Consistency and state

The revision label and schedule version identify the accepted schedule used by
the activity counts. Pending claims never change those counts. Accepted history
may retain evidence from earlier revisions, as the audit record requires.

Loading, no project, wrong role, no active schedule, empty discipline, empty
attention, empty accepted history, revoked access, changed data, history limit,
backend failure and cached offline states are explicit. Cached results are
labeled potentially stale and cannot be refreshed offline.

Automated tests use synthetic records and mocked Supabase transport. They do
not prove production RLS, cross-client parity or physical-device layout; those
remain manual checks with owner-designated accounts and projects.
