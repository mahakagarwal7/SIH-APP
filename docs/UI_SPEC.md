# UI_SPEC.md — Visual spec matched to the uploaded reference screens

**This supersedes the earlier note in `CODEX.md` §2** that called the mobile
reference screens "UX reference only, don't match visual style." You've now
asked for the UI to match those 8 reference screens exactly, screen-for-
screen — layout, colors, cards, badges, and bottom nav — while all mappings,
routes, and backend contracts stay exactly as already defined in `CODEX.md`
and `docs/FEATURES.md`. Only the wordmark changes: "SitePulse" → "Nirmaan" in
the header; everything else visually should match.

Give this to Codex as its own step per screen (8.1–8.8 below), not all at
once — restyling is easy to get subtly wrong across 8 screens in one pass.

## Shared design tokens (apply everywhere)

- **Background:** light neutral (off-white/very light gray), white cards on
  top with soft shadow and rounded corners (~12–16px radius)
- **Status colors:** green = done/healthy/accepted, blue = in-progress/info,
  amber/orange = pending/attention, red = delayed/critical, purple = a
  secondary progress accent (used for "View Progress")
- **Typography:** bold sans-serif for headings and big numbers, regular
  weight for labels/metadata, small uppercase gray labels above values (e.g.
  "TODAY", "WORK AREA COMPLETE")
- **Bottom tab bar:** persistent on every screen — Home, Report, Tasks,
  Alerts, Profile, each with an icon + label, active tab highlighted
- **Top bar:** app wordmark ("Nirmaan") top-left, a settings/gear icon
  top-right; screens reached via drill-down (Speak Progress, Task Hierarchy)
  get a back arrow instead of the wordmark
- **Status time on native header bar** is device-provided, not app UI —
  ignore the "09:41" mock status bar in the reference, that's just the
  design tool's device frame

---

## 8.1 — Home screen

- Header: "Nirmaan" + gear icon
- Project summary card: big percentage (e.g. "75%") with "DONE" label,
  project name (e.g. line/metro name), site name, and an "ON TIME" (or
  delayed-state equivalent) status pill
- 2×2 action grid below the card: **Speak Report** (mic icon), **Take
  Photo** (camera icon), **My Tasks** (list icon), **View Progress** (chart
  icon) — each its own tinted rounded button, tap targets large enough for
  gloved/field use
- Bottom tab bar (Home active)
- Data source: project summary = aggregate from `activities`/schedule
  status for the active project (`CODEX.md` §3, Feature 5); this screen does
  **not** get new data — only new layout matching the reference

## 8.2 — Speak Progress screen

- Header: back arrow + "Speak Progress" + gear icon
- Language selector: pill row (flag + label per language) — ship the
  languages confirmed in `CODEX.md` §5 (don't add Tamil unless confirmed)
- Large circular record button (red when recording) with a live waveform
  visualization and a "RECORDING VOICE…" label while active
- Bottom row: **Cancel** (outline button) and **Submit** (filled) side by
  side — wire these to the flow defined in `docs/FIXES.md` 7.2, not the old
  flow
- Bottom tab bar (Report active)

## 8.3 — Photo capture screen

- Full-screen camera viewfinder with a subtle grid overlay
- Top bar: back arrow, flash toggle, camera-flip icon, all as transparent
  overlay icons on the viewfinder
- Bottom-left: thumbnail strip of already-attached photos for this report
  - a "＋" add tile
- Bottom-center: large white shutter circle
- Bottom-right: a "use/refresh" icon for retake
- After shutter tap: behaves per `docs/FIXES.md` 7.1/7.3 — attaches
  immediately, compresses in background, doesn't block the viewfinder

## 8.4 — My Tasks screen

- Header: "My Tasks" + gear icon
- Date selector pill with left/right chevrons (e.g. "TODAY, 26 JAN") — wire
  the chevrons to step through days; this is a date **navigator**, separate
  from the date-picker fix in `docs/FIXES.md` 7.4 which is for report work
  dates, not this list filter
- Task list, each row: colored status icon/circle, task name, thin progress
  bar with percentage, and a right-aligned status element that's one of:
  a "DONE" badge (green), a "WORKING" badge (blue), a "START" button
  (for not-yet-started tasks), or a "DELAYED" badge (red)
- Bottom tab bar (Tasks active)
- Data source: `activities` scoped to the current user, per
  `docs/FEATURES.md` Feature 5 — read-only

## 8.5 — Task Hierarchy screen

- Header: back arrow + "Task Hierarchy" + gear icon
- "CURRENT TASK" callout card at top naming the field task
- Below it, a vertical drill-down chain connected by lines, each level with
  a percentage and label: Project Milestone → WBS Package (%) → Activity L5
  (%) → Activity L6 (%) → Field Task (%) — matches the ER relationships in
  `docs/ARCHITECTURE.md` §1 (`ACTIVITIES` → `ACTIVITY_PLAN_VERSIONS`/
  `ACTIVITY_ACTUALS` chain); render whatever depth the real hierarchy data
  has, the reference's 5 levels are illustrative, not a fixed count
- Bottom action row: a mic shortcut (jump to Speak Progress for this task),
  a share icon, and an "UPDATE STATUS" primary button
- This screen is **read-only** per `docs/FEATURES.md` Feature 1 — "UPDATE
  STATUS" opens the report flow, it does not edit the hierarchy itself

## 8.6 — Progress Overview screen

- Header: "Progress Overview" + gear icon
- Donut chart, center label "75% TOTAL" (or actual aggregate), color-coded
  legend below (Foundation/Structure/MEP Works or whatever disciplines the
  active project actually has — don't hardcode these three)
- "WORK AREA COMPLETE" section: one horizontal bar per work area with a
  trailing percentage
- "WEEKLY PROGRESS TREND" section: simple bar chart, days of week on the
  x-axis
- Bottom tab bar — this screen is reached from the Home action grid, not a
  dedicated tab; keep whichever tab was previously active highlighted
- Data source: this is the manager-panel polish item, `docs/ROADMAP.md`
  step 6.1 — build the visual shell now if asked, wire real aggregates when
  6.1 is actually scheduled

## 8.7 — Alerts & Approvals screen

- Header: "Alerts & Approvals" + gear icon
- Filter tabs: **All**, **Critical** (with count badge), **Pending** (with
  count badge)
- Alert cards: red left-border + warning icon for critical items, green
  left-border + check icon for approved/resolved items; each card shows a
  relative timestamp ("10 mins ago"), a one-line description, and a **View
  Details** button
- Bottom tab bar (Alerts active)
- **Do not wire this to real data yet** — per `CODEX.md` §5, Alerts scope
  needs confirmation before it's built as a real feature; build the visual
  shell only if explicitly asked to, and use obviously-fake placeholder
  content, not silently-invented backend calls

## 8.8 — Manager Panel screen

- Header: "Manager Panel" + project name + a health-status pill (e.g.
  "HEALTHY" in green; should reflect real delay/variance thresholds once
  wired, not always green)
- Stat row: Tasks (e.g. "24/32"), Workers, Delays, and a Variance
  percentage with up/down indicator
- "Timeline Scheduler" section: one progress bar per discipline
- "Recent Verified Field Updates" list: worker name, matched task, relative
  timestamp
- Bottom tab bar — this is the manager persona's Home equivalent; confirm
  with the human whether it replaces or sits alongside the Field persona's
  Home from screen 8.1 (see `docs/ROADMAP.md` Phase 2/6 for how persona
  switching is structured)

---

## What does NOT change

- Backend calls, table/RPC names, RLS behavior — none of this is a UI task
- The three-way delivery-state rule (Saved on device / Awaiting review /
  Accepted) from `CODEX.md` §2 — still shown explicitly, just restyled to
  match the reference's card/badge language
- The "quantity ≠ completion" and "honest states" rules — a restyled
  progress bar still needs to show partial/unrecorded values honestly, not
  just a clean percentage because it looks better
