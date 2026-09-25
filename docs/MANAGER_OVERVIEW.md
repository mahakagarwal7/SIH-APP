# Manager overview aggregate boundary

Roadmap 6.1 supplies the read-only manager data boundary. UI step 8.8 presents
that data as the Manager Panel in the approved Manager Overview tab, following
the eighth mobile reference without inventing unsupported project measures.

## Production sources

The screen reads three existing authenticated, RLS-protected sources for the
selected project:

- `schedule_snapshot(p_project)` supplies the active revision, schedule version
  and accepted activity actuals;
- `execution_history(p_project)` supplies accepted evidence and correction
  status;
- actionable `claims` in `pending`, `clarification`, `verification` or
  `disputed` state supply an exact pending-review count.

Only active planners and managers may start these reads. The client validates
each payload, rejects cross-project or incomplete attention pages, and rechecks
the same `project_members` row, role and membership version after all sources
load. Project switching clears the overview cache.

## Defined measures

- **Planned activities** is the number of reportable activities in the active
  schedule snapshot.
- **Completed activities** have an accepted `actualFinish`.
- **Tasks** shows accepted-finished activity count over planned activity count.
  It does not weight quantity, duration, cost or criticality.
- **In progress** activities have an accepted `actualStart` and no accepted
  finish.
- **Reported progress without a start** is shown separately and never counted
  as started or complete.
- **Claims needing action** is the exact count returned by the actionable
  claims query. It counts claims, not distinct reports.
- **Discipline completion** is completed activity count divided by planned
  activity count within that discipline. The numerator and denominator remain
  visible beside the bar.
- **Recent verified field updates** are the five newest effective events by
  acceptance time. They show the recorded reporter label from accepted
  provenance, the matched activity and a relative acceptance time. Missing
  reporter provenance is labeled rather than inferred.

Project health, worker count, delays and variance are displayed as **Not
recorded**. The screen deliberately has no weighted schedule completion,
health score, schedule variance claim, productivity rate, cost forecast or
inferred status. Those measures require an agreed definition or a new backend
contract.

## Consistency and state

The revision label and schedule version identify the accepted schedule used by
the activity counts. Pending claims never change those counts. Accepted history
may retain evidence from earlier revisions, as the audit record requires.

Loading, no project, wrong role, no active schedule, empty discipline, empty
accepted history, revoked access, changed data, history limit, backend failure
and cached offline states are explicit. Cached results are labeled potentially
stale and cannot be refreshed offline.

Automated tests use synthetic records and mocked Supabase transport. They do
not prove production RLS, cross-client parity or physical-device layout; those
remain manual checks with owner-designated accounts and projects.
