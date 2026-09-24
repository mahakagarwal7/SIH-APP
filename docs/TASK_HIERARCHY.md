# Task hierarchy consistency boundary

Roadmap 2.2 adds a read-only mobile drill-down from Field **My work** and
Manager **Schedule**. The screen represents source schedule relationships; it
does not calculate a replacement hierarchy or write schedule data.

## Production contract

The screen calls the existing authenticated `schedule_snapshot(p_project)` RPC
and parses the same strict snapshot contract as Manager Schedule. It identifies
the requested activity only among the activities returned under RLS, builds the
branch from `schedule_nodes.parentId`, and then rechecks the same active
`project_members` row, role and membership version before returning data.

Planners and managers receive the visible `schedule_nodes` tree allowed by the
production policy. Reporters and supervisors may receive no node collection;
for them, the screen uses only the requested activity's stored `hierarchyPath`
and labels the result as limited. It never queries another activity to fill a
hidden branch. A requested activity that is absent from the RLS-visible
snapshot is reported as unavailable without revealing another branch.

## Display rules

- Source identifiers, names, levels, WBS values, kinds, dates and parent links
  are displayed as supplied. Missing parents remain explicit.
- Duplicate identifiers and parent cycles invalidate the snapshot rather than
  being repaired on-device.
- Selecting a path node shows its direct visible children. A leaf has an
  explicit empty state.
- The selected activity card shows assignment context and accepted quantities,
  dates and percentage. It does not roll those facts up to parent nodes.
- Focus resets when the project, revision, schedule version or requested
  activity changes.
- Cached data is identified as stale offline. Refresh first rechecks project
  access and then reloads the hierarchy.

The slice adds no schema, policy, RPC, dependency, secret or backend mutation.
Schedule import, revision activation and assignment changes remain web-only.

## Evidence boundary

Unit and screen tests use synthetic snapshots and mocked transport. They cover
all four mobile roles, exact RPC input, access/version rechecks, hidden
activities, missing parents, cycles, limited paths, branch navigation, leaves,
revision resets and offline/error states. They do not prove production RLS,
cross-client parity or physical-device layout; those remain manual checks with
owner-designated accounts and projects.
