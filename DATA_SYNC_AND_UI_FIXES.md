# DATA_SYNC_AND_UI_FIXES.md — Phase 9 (one single PR)

**This phase is an exception to the normal "one roadmap step per PR" rule in
AGENTS.md.** The bugs below are reported as separate symptoms but several of
them share one root cause (real Supabase data isn't reaching the screens),
so splitting them into 8 separate PRs would mean fixing the same root cause
8 times. Do all of 9.0–9.7 in **one branch, one PR** — but still commit
atomically per section (RULES.md commit conventions still apply), still
never `git push` (AGENTS.md §1), and still write one PR draft at
`docs/pr-drafts/phase-9-data-sync-and-bugs.md` covering all sections.

**Do the sections in order.** 9.0 first, always — most of what follows is
either caused by it or impossible to verify without it fixed first.

---

## 9.0 — Root-cause the data sync issue (do this before writing any fix)

Symptoms reported: Home shows 0% despite real data existing in Supabase, My
Work is completely empty, My Reports doesn't update, Manager Progress
Overview shows 0% across every discipline despite "149 planned activities"
being a real number on screen, and the Review/Claim decision buttons stay
disabled. These are very likely the same bug in five places, not five bugs.

**Investigate and report findings before fixing anything:**

1. Confirm `EXPO_PUBLIC_SUPABASE_URL` / anon key (or however they're named
   in this repo's `.env`) point at the **exact same Supabase project** the
   web app uses. A mismatched project would explain every symptom at once.
2. Sign in as the same user on mobile, then run the equivalent query
   directly in the Supabase SQL editor (or via the web app) for that user +
   project (`Urban Garbage Treatment Plant · Town XYZ`) and confirm rows
   actually exist and RLS allows reading them as that user. If RLS blocks
   it, the fix is a policy/role issue, not a frontend bug.
3. Grep the mobile codebase for hardcoded/placeholder/fallback values (a
   literal `0`, `[]`, `"No assignment today"` used as a default instead of a
   real "no data" state) that could be silently masking a failed fetch on
   Home, My Work, My Reports, and Progress Overview. Report every place this
   pattern is found.
4. Check whether failed Supabase calls are being swallowed (empty catch
   blocks, `.catch(() => {})`, errors not logged) — this would explain why
   the UI shows "0%" instead of an error.
5. Report back, in the PR draft, which of the above was the actual cause
   before moving to 9.1+. If it turns out to be several different causes
   across different screens, say so explicitly.

**Required standing behavior going forward (apply to every screen touched
in this phase):**

- No screen renders a hardcoded/default 0%, empty list, or placeholder text
  as if it were real data. A screen either shows real data, a real loading
  state, a real empty state (e.g. "no activities assigned today" — only
  shown when the query succeeded and genuinely returned nothing), or a real
  error state with a retry action.
- Add a way to see the underlying error during development (a dev-only
  banner, or at minimum a `console.warn`/logging call with the Supabase
  error object) so this class of bug is visible next time instead of
  silently rendering zero.

---

## 9.1 — Field: Home, My Work, My Reports wired to real data

Once 9.0's root cause is fixed:

- **Home** (`ACTIVITIES DONE` ring, current activity card, `ON TIME`/status
  pill): computed from the signed-in user's real `activities` /
  `activity_actuals` for the active project (`CODEX.md` §3 Feature 5). If
  there's genuinely no assignment today, keep "No assignment today" — but
  only when the query actually returned empty, not as a default.
- **My Work**: list the user's actual assigned activities from
  `activities`/`schedule_nodes`, scoped by `project_members`. Currently
  empty on every load — confirm the query filter uses the signed-in
  `auth.uid()` correctly and isn't pointed at an unused/placeholder table or
  a hardcoded empty array.
- **My Reports**: list the user's actual `reports`/`report_versions` rows.
  Confirm `submit_field_capture` is actually writing rows the mobile app
  later reads back — test by submitting one report and checking directly in
  Supabase that a row appears, then confirm My Reports' query would return
  that exact row for that exact user.

**Acceptance criteria:**

- [ ] Submitting a new report makes it appear in My Reports within the
      normal sync delay, without a manual app restart
- [ ] Home's activity count matches what the same user/project shows on the
      web app, side by side
- [ ] My Work lists the same assigned activities the web app shows for that
      user

---

## 9.2 — Manager: Progress Overview and Review/Claim wired to real data

- **Progress Overview** donut + per-discipline bars (`Civil`, `Electrical`,
  `General`, `HSE`, `Instrumentation`, `Mechanical`, `Piping`, `Quality`,
  `Structural`): compute as a real aggregate over `activities`/
  `activity_actuals` for the active project. The screen already correctly
  shows "149 planned activities" as a real count — so data access partly
  works; the per-discipline/`TOTAL` aggregate specifically is what's wrong.
  Find where that aggregate is computed and fix it, don't just re-fetch.
- **Review/Claim decision screen**: "Accept verified event" renders
  permanently disabled and "Reject claim" doesn't respond. Find the actual
  `disabled` condition on each button:
  - If it's gated on required fields (e.g. `Decision reason`), the button
    should enable as soon as that field has content — verify this actually
    works by typing in the field.
  - If it's gated on the claim record having loaded, this is likely another
    instance of the 9.0 root cause — confirm the claim data is arriving at
    all.
  - "Reject claim" should not require a reason to be enabled (matches the
    web app's review flow, where reject and accept-with-reason are distinct
    actions) — verify against `docs/FEATURES.md` Feature 3 and the web app's
    actual behavior; don't guess if unsure, note it in the PR draft instead.

**Acceptance criteria:**

- [ ] Progress Overview's per-discipline percentages match the web app for
      the same project
- [ ] Typing a decision reason and tapping "Accept verified event" actually
      submits a decision (`/api/v1/verifications/[requestId]/decisions`)
      and the claim leaves the review queue
- [ ] "Reject claim" is independently usable and also submits correctly

---

## 9.3 — Speech-to-text: the transcription pipeline needs a real provider wired in

**Context for you (the human), not just Codex:** "Transcribing…" never
resolving means nothing is actually calling a speech-to-text service — the
mobile app was always going to show that forever until this exists
server-side. This is not something the mobile app itself should do (an API
key for a transcription provider must never ship inside the mobile bundle —
see `RULES.md` §6). It belongs in whatever process already leases
`media_jobs` (`lease_field_media()`) — i.e. the **worker**, per
`docs/ARCHITECTURE.md` §3 and §4. If that worker doesn't exist yet as real
code (as opposed to just being a box in the architecture diagram), that's
the actual bug to fix, and it's likely a different repo than this mobile
one — confirm that with the human before assuming it belongs in this PR.

**Recommended provider:** OpenAI's `/v1/audio/transcriptions` endpoint
(`whisper-1` or `gpt-4o-transcribe`) is the simplest to wire in and already
handles Hindi/English/mixed speech well, matching the "Speak, then check"
design requirement. Any equivalent STT provider (Google Cloud
Speech-to-Text, AssemblyAI, Deepgram) works the same way structurally if one
is already contracted — this is a provider choice for the human to confirm,
not something to assume.

**Required worker-side flow (wherever the worker actually lives):**

1. `lease_field_media()` picks up a queued `media_jobs` row for an audio
   attachment.
2. Worker downloads the audio from the `evidence` storage bucket.
3. Worker calls the transcription provider with that audio file.
4. Worker writes the resulting text into `media_results` and calls
   `complete_field_media(...)` to mark the job done.
5. Mobile's existing poll/subscribe logic (from `docs/FIXES.md` 7.2) picks
   up the new `media_results` row and replaces "Transcribing…" with the
   real text — this part should already work once the worker actually
   produces a result; don't rebuild the mobile side unless testing shows
   it's also broken.

**Acceptance criteria:**

- [ ] Recording a short, clear phrase and submitting produces a transcript
      in `media_results` within a reasonable time (target underto 15
      seconds for a ~10 second clip)
- [ ] The transcript reaching the mobile app matches what was actually said
- [ ] No API key for the transcription provider exists anywhere in the
      mobile app's bundle or source — confirm this explicitly in the PR
      draft

**If the worker code is not part of this repo:** stop, don't try to build a
worker inside the Expo app to work around it, and tell the human exactly
what's missing and where it needs to live instead.

---

## 9.4 — Field report review: the date picker is referenced but not rendered

The review-voice-report screen shows the validation message "Choose today or
an earlier work date." but there is no actual date control on screen for the
user to choose one — this is `docs/FIXES.md` step 7.4, which was speced
earlier but appears not to have been implemented on this specific screen.
Render the date picker described in 7.4 directly on this screen, wired to
the same validation that's currently producing the message with nothing to
act on.

**Acceptance criteria:**

- [ ] A tappable date field/button is visible on the review screen whenever
      that validation message would show
- [ ] Picking a date clears the validation message and allows Submit

---

## 9.5 — "Discard draft" errors instead of discarding

Reported: tapping "Discard draft" on a report that has already entered the
outbox produces an error rather than discarding cleanly.

**Required behavior:**

- If a draft is still purely local (never queued for upload), "Discard
  draft" deletes it immediately and cleanly — no error.
- If a draft has already entered the outbox (sent for review, upload
  in-flight or complete), tapping "Discard draft" must **not** throw an
  error. Instead:
  1. Show a confirmation dialog explaining the local copy will be removed
     but the already-submitted report is not cancelled server-side, or
  2. If discarding a submitted draft isn't a supported action, disable the
     button in this state with a short explanation instead of leaving it
     tappable and erroring.
- Either way, find and fix the actual thrown error — a disabled/guarded
  button is not a substitute for fixing the underlying crash if the human
  later needs discard-while-queued to work.

**Acceptance criteria:**

- [ ] Discarding a not-yet-sent draft works with no error
- [ ] Attempting to discard an already-queued/sent draft never crashes or
      shows a raw error — it either succeeds with a clear confirmation or is
      disabled with a clear explanation

---

## 9.6 — Workspace switcher available on every screen, not just Account

The Field/Manager workspace switch (visible as "FIELD" / "MANAGER" under the
wordmark in the current screens) is currently only reachable from Account.
Move it — or add an equivalent control — to the persistent top header so
it's reachable from any screen, matching how "Change project" already
appears in the header on every screen today. Don't remove the per-screen
"Change project" control; add the workspace switch alongside it in the same
persistent header area.

**Acceptance criteria:**

- [ ] From any screen in either workspace, the user can switch workspace
      without navigating to Account first
- [ ] The existing "Change project" control still works exactly as it does
      today

---

## 9.7 — Confirmation feedback (toast/snackbar) on every mutating action

There's currently no feedback when a report is submitted, sent for review,
discarded, or when a claim is accepted/rejected — the user can't tell
whether their tap did anything. Add a shared, app-wide toast/snackbar
system (a single provider/context used everywhere, not one-off
implementations per screen) and trigger it on:

- Report submitted / sent for review
- Report discarded
- Claim accepted
- Claim rejected
- Sync failure (any of the above failing) — with a distinct error style

**Acceptance criteria:**

- [ ] Every action listed above shows a brief, non-blocking confirmation or
      error message
- [ ] The toast system is one shared component, not duplicated per screen
- [ ] Toasts auto-dismiss and never block the user from continuing to use
      the screen underneath

---

## 9.8 — Regression pass (final step of this PR)

- [ ] Home, My Work, My Reports, Progress Overview, Review/Claim all show
      real data matching the web app for the same user/project
- [ ] A full report round-trip works: record voice → transcript appears →
      submit → appears in My Reports → status updates when accepted
- [ ] Date picker appears wherever the "choose a work date" validation can
      fire
- [ ] Discard draft never errors, in both the not-yet-sent and
      already-queued states
- [ ] Workspace switch works from every screen
- [ ] Toasts fire for every mutating action listed in 9.7
- [ ] Nothing from `docs/FEATURES.md` or `docs/FIXES.md` (Phase 7)
      acceptance criteria has regressed
