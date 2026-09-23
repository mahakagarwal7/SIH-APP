# Roadmap 0.3 navigation proposal

Status: approved by the owner on 23 September 2026. The owner accepted the Field and Manager tabs below, shared header account/project controls, and deferral of Alerts for step 0.3. Prepared from Nirmaan design-book pages 2 and 8–11 and the project review.

## Proposed shell

After sign-in, show two workspace entries: Field and Manager. Each opens the corresponding placeholder shell. Account and project controls sit in the shared header; account includes switching workspace and signing out.

| Workspace | Bottom tabs, in order               | Design basis                                           |
| --------- | ----------------------------------- | ------------------------------------------------------ |
| Field     | Home, Report, My work, My reports   | The four field tabs in Nirmaan pages 8–11              |
| Manager   | Overview, Review, Schedule, History | Compact grouping of the planner destinations on page 2 |

The manager grouping is a proposal for mobile, not a literal four-tab layout supplied by the PDF. Review holds future pending-decision/evidence flows; History holds future accepted records. Exports remain a later feature and do not need a tab in this slice.

```text
Nirmaan.                 Account
Project: Not selected    Change project
Offline banner when disconnected

Current screen title
Honest unavailable state for the unfinished feature

Home | Report | My work | My reports       (Field)
Overview | Review | Schedule | History     (Manager)
```

Only one workspace's tab bar is visible at a time. Use the established navy/serif masthead, thin rules, light page ground, accessible labels and large touch targets. Keep the shell in the current English copy; language support remains a separate unresolved scope decision, with no nonfunctional language toggle.

## Slice boundaries

- Project switching is a stub: show “No project selected” and explain that selection is not yet available. Do not fabricate projects, membership, assignments, pending counts or accepted records.
- Workspace selection changes presentation only. It does not assign a project role, alter a JWT, or enable data/decision operations. Real project access will be derived from authenticated membership in its later slice.
- No Alerts screen or push notifications in 0.3. Their product scope remains open; this proposal does not permanently remove them from v1.
- Existing sign-in, restore, retry, offline, expiry and sign-out behavior remains shared across routes. Signed-out users cannot open workspace routes by URL/back navigation.
- No report capture, submission, schedule data, manager decisions or backend transport changes in this shell.

## Implementation and review checks after approval

Use a single auth provider above Expo Router so changing screens cannot create competing session controllers. Keep route access tied to the current session and clear workspace navigation when that session ends. Add focused tests for shared-session subscriptions, direct-route auth guards, workspace switching, tab selection and returning from project/account screens.

Verify typecheck, lint, formatting, Jest, Android/iOS/web exports and browser navigation/back behavior. Check phone-width and large-text layouts against the PDF. Record native/device limitations and the still-missing production publishable key separately.

The feature branch started from auth PR #2. After PR #1 and PR #2 merged, the navigation branch incorporated current main and its review fixes, and PR #3 now targets main. PR merging remains with the owner.

## Decision record

The owner selected “Approve this navigation” for this proposal. This resolves the navigation needed for 0.3 and defers Alerts within this slice; it does not decide languages, v1 Alerts/push scope or business API transport. [AGENTS.md](../AGENTS.md) and [the development workflow](DEVELOPMENT_WORKFLOW.md) reserve those unresolved product and architecture questions for the owner.
