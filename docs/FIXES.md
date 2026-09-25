# FIXES.md — Phase 7 bug fixes

These are fixes for issues found after Feature 2 (field reporting) was
implemented. Each is scoped as its own roadmap step (7.1–7.5) — hand them to
Codex **one at a time**, same as every other step, and update
`docs/pr-drafts/` per step as usual.

Before starting, have Codex re-read the current `src/features/field-reports/`
code (and offline outbox code) so it's fixing what actually exists, not
guessing.

---

## 7.1 — Make voice, text, and photo fully independent inputs

**Bug:** submission currently seems to require all three (or a fixed
combination) before it can be sent.

**Required behavior:**

- A report is valid and submittable with **any one** of: a voice recording
  (with its transcript), typed text, or a photo. Any combination of the
  three is also valid.
- The Submit/Send button is enabled as soon as **at least one** input is
  present and (for voice) has finished transcribing — never gated on all
  three being filled.
- Remove any validation that treats voice/text/photo as required fields in
  the same form. They are independent evidence types attached to one report,
  not three mandatory fields.

**Acceptance criteria:**

- [ ] Submitting with only a photo succeeds
- [ ] Submitting with only typed text succeeds
- [ ] Submitting with only a voice note succeeds
- [ ] Submitting with any 2-of-3 or all 3 still works as before
- [ ] Submit button's enabled/disabled state matches "at least one input
      present" exactly — write a test for this logic, not just the UI

---

## 7.2 — Auto-transcribe voice notes, with an explicit send step

**Bug:** after recording, there's no clear "send" step, and transcription
doesn't happen automatically.

**Required flow (matches `CODEX.md` §3 Feature 2 contract):**

1. User taps record, speaks, taps stop → recording is saved locally
   immediately (no network wait here).
2. Screen moves to a **review state** showing: a playback control for the
   raw recording, a "Transcribing…" placeholder, and **Cancel** / **Send**
   actions that are available immediately — don't block Send on
   transcription finishing.
3. In the background, kick off the existing backend chain
   (`reserve_field_capture` → upload → `finalize_field_media`) as soon as
   recording stops, _not_ when the user taps Send. Transcription happens
   server/worker-side per the existing architecture
   (`docs/ARCHITECTURE.md` §3) — the app polls/subscribes for the result and
   fills in the transcript text on this same screen once it arrives.
4. If the user taps Send before the transcript arrives, that's fine — the
   report submits with the audio attached and the transcript backfills the
   report record when the worker finishes (existing async contract, same as
   the photo/media flow).
5. If the user taps Cancel, discard the local recording and cancel/ignore the
   in-flight upload.

**Acceptance criteria:**

- [ ] Recording stop → review screen appears in under ~300ms (no network
      call blocks this transition)
- [ ] Upload/`reserve_field_capture` fires automatically after stop, not
      after Send
- [ ] Send is tappable immediately, doesn't wait on transcription
- [ ] Transcript text appears on-screen once the worker returns it (poll or
      Realtime, per `CODEX.md` §5), editable before final submit if not yet
      sent
- [ ] Cancel actually cancels/discards the local file and doesn't leave an
      orphaned upload

---

## 7.3 — Fix high processing/perceived latency after capture

**Bug:** after recording audio, typing text, or picking a photo, the app
appears to hang or takes a long time before the user can do anything else.

**Likely causes to check first** (inspect the current code for these before
assuming a rewrite is needed):

- The UI thread is blocked waiting on the _full_ upload + `finalize_field_media`
  round-trip before rendering the next screen, instead of navigating
  immediately and uploading in the background.
- Media (photo/audio) isn't compressed/resized before upload — a full-res
  photo or uncompressed audio file takes far longer to upload than needed.
- The app waits for `submit_field_capture` to return before showing any
  confirmation, instead of showing an optimistic "Saved / Sending…" state.
- Sequential (not parallel) calls where they don't need to be — e.g.
  `finalize_field_media` for a photo and a separate text save happening one
  after another instead of concurrently.

**Required behavior:**

- Every capture action (record stop, text submit, photo taken/picked)
  updates the UI **optimistically and instantly** — write to the local
  offline-outbox store first, render the new state immediately, then sync in
  the background.
- Show a lightweight non-blocking indicator (e.g. a small "Uploading…" chip
  on the report row in My Reports) instead of a full-screen blocking spinner.
- Compress photos client-side before upload (e.g. `expo-image-manipulator`,
  resize to a sane max dimension/quality) and cap audio recording quality to
  what's needed for speech transcription, not maximum fidelity.
- Target: user can move on to the next action (record another report, leave
  the screen, background the app) within ~1 second of finishing a capture,
  regardless of network conditions.

**Acceptance criteria:**

- [ ] No capture action blocks the UI thread on a network call
- [ ] Photos are compressed before upload; note the size reduction achieved
      in the PR draft
- [ ] A background/slow-network simulation (throttle or airplane-mode test)
      still lets the user navigate immediately after capture
- [ ] My Reports shows a distinct "Uploading" sub-state so the user can see
      _why_ something isn't Accepted yet, instead of it looking frozen

---

## 7.4 — Replace manual date entry with a date picker

**Bug:** work date is a free-text field.

**Required behavior:**

- Replace the text input with a native date picker
  (`@react-native-community/datetimepicker`, or a calendar modal component
  consistent with the rest of the UI kit chosen in `docs/UI_SPEC.md`).
- Default value: today's date, in the device's local timezone.
- Disallow future dates (a field report can't be dated ahead of now) unless
  a specific reason to allow it is found in the existing web app behavior —
  if unsure, ask rather than guessing.
- Keep the "Not recorded" honesty rule from `CODEX.md` §2 — if no date has
  been confirmed yet (e.g. mid-edit), don't silently default it in the data
  sent to the backend; only send a date once the user has confirmed it.

**Acceptance criteria:**

- [ ] No free-text date entry remains anywhere in the report flow
- [ ] Picker defaults to today, blocks future dates
- [ ] Selected date displays in a consistent, readable format matching the
      rest of the app (e.g. "20 Sep 2026")

---

## 7.5 — Regression pass

After 7.1–7.4 are all done, do one pass end-to-end:

- Submit reports with each of the 7 possible input combinations
  (V, T, P, VT, VP, TP, VTP) and confirm all succeed and show correctly in
  My Reports.
- Confirm the three delivery states (Saved on device / Awaiting review /
  Accepted) still render correctly for each combination.
- Confirm nothing from Feature 2's original acceptance criteria in
  `docs/FEATURES.md` regressed.
