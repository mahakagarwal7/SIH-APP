# FEATURES.md — Mobile Feature Specs

Each feature below mirrors a backend feature already defined for the web app
(see `CODEX.md` §3). This file defines what "done" looks like on mobile
specifically. Build in the order given in `docs/ROADMAP.md`, not the order
listed here (Feature 2 ships first — it's the core mobile use case).

---

## Feature 2 — Field reporting with media
**Persona:** field worker/supervisor
**Screens:** Home (current work card), Report (voice/text/photo tabs),
Confirmation ("is this correct?"), My Reports (delivery-state list)

**User flow:**
1. Worker opens the app, sees today's assigned activity on Home.
2. Taps "Speak a progress report" (or Text / Photo) → records/enters →
   reviews a confirmation screen showing transcript, work date, suggested
   activity match, and any explicitly-flagged partial work.
3. Submits. If offline, it's saved on-device and queued; if online, it
   uploads and moves to "Sent for review".
4. My Reports shows each report's state: **Saved on device → Awaiting
   review → Accepted/Rejected**, always as three distinct states.

**Acceptance criteria:**
- [ ] Works fully offline for capture + local save; queued reports upload
      automatically on reconnect (or via explicit "sync now")
- [ ] Never shows a report as "sent" if it's still only saved locally
- [ ] Partial work (e.g. "2 of 8 spools, NDT pending") is shown explicitly,
      not summarized as a percentage
- [ ] Report status updates once `media_results` / report row changes
      (poll or Realtime)
- [ ] Backend calls used, in order: `reserve_field_capture` →
      `finalize_field_media` → `submit_field_capture`

---

## Feature 5 — Assignment & project overview
**Persona:** both
**Screens:** Project switcher, Home (current work), Task Hierarchy
drill-down

**User flow:**
1. User picks their active project (if a member of more than one).
2. Home shows their current assignment(s) for today, sourced from
   `project_members` + `activities`.
3. Tapping an activity opens a read-only hierarchy: milestone → WBS package
   → activity → field task, matching the web app's activity record panel.

**Acceptance criteria:**
- [ ] Project list only shows projects where the user is a `project_member`
- [ ] Hierarchy view is read-only on mobile (editing stays on web)
- [ ] Empty state ("no assignment today") is explicit, not a blank screen

---

## Feature 3 — Claim review & verification
**Persona:** planner/manager
**Screens:** Review queue (list), Decision screen (accept/reject + reason)

**User flow:**
1. Manager opens Review Queue, sees pending claims with the same
   ambiguity/candidate-match context the web review screen shows (original
   report text, suggested activity, why it's flagged).
2. Opens a claim, reads the original field report, picks the correct
   activity link (if ambiguous) or keeps it for clarification, and submits
   a decision.

**Acceptance criteria:**
- [ ] Decision screen shows the original field-report text verbatim and the
      candidate activity matches with their match reason (mirrors the web
      "Explain the match" panel)
- [ ] "Accept" always requires the reviewer to confirm the specific activity
      link, never auto-accepts the top candidate silently
- [ ] Calls `/api/v1/claims/[claimId]/verifications` then
      `/api/v1/verifications/[requestId]/decisions`
- [ ] Decision is recorded in `review_decisions`; queue count updates
      immediately on the device that made the decision

---

## Feature 1 — Schedule (read-only on mobile)
**Persona:** planner/manager (view), field worker (their own activities only)
**Screens:** Schedule list/Gantt-lite, revision status banner

**User flow:**
1. User opens Schedule, sees the currently *activated* revision's activities
   grouped by discipline, with baseline vs. actual where available.
2. No import, no activation controls on mobile — those stay desktop-only.

**Acceptance criteria:**
- [ ] Shows only the active schedule revision (`activate_schedule_revision`
      result), never a stale/inactive one
- [ ] No write actions on this screen at all
- [ ] Missing actual dates render as "Not recorded", never blank or "0"

---

## Feature 4 — Planner export generation (lowest priority)
**Persona:** planner/manager
**Screens:** Export trigger + status

**User flow:**
1. Manager taps "Export" on a project, sees a status card (queued →
   generating → ready) and a link/share sheet once ready.

**Acceptance criteria:**
- [ ] Triggers `/api/v1/projects/[projectId]/exports`, does not attempt to
      generate the package client-side
- [ ] Shows manifest/integrity info if the API returns it; otherwise a
      simple ready/download state is enough for v1

---

## Cross-feature UI requirements (apply to every screen above)
- Loading, empty, and error states are all explicitly designed — no bare
  spinners with no explanation, no silent failures
- All dates respect the "Not recorded" rule from `CODEX.md` §2
- Language: English + Hindi at minimum (confirm Tamil scope — see
  `CODEX.md` §5)
- Visual language follows the Nirmaan design book, not the "SitePulse"
  reference screens' exact styling
