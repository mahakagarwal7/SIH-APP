# Confirmation and submission contract

Roadmap 1.4 adds the explicit **Check → Send** boundary. Voice and photo evidence must first be uploaded and verified through roadmap 1.5; text-only captures can be confirmed offline before reservation. The mobile app uses the existing production `submit_field_capture(p_report, p_text, p_work_date, p_activity)` RPC under the signed-in user's RLS context. It changes no schema, worker or web API.

## What the worker confirms

The confirmation screen keeps the verified original voice transcript read-only and places editable submitted wording beside it. Text/photo drafts start with their saved wording. The worker may add an optional ISO work date and select an activity from the current RLS-scoped `schedule_snapshot`; leaving either value unrecorded is explicit. The screen asks the worker to check names, quantities, dates and unfinished-work wording before enabling send.

The production contract has no pre-submit AI suggestion or separate partial-work flag. The app therefore does not invent either field. Partial or unfinished work stays in the confirmed wording, with a concrete prompt such as “2 of 8 complete; 6 remain unfinished.” The activity choice remains optional and the submit RPC rechecks its authorization.

## Immutable retry

Before the first submission attempt, SQLite stores the normalized tuple below on the existing account-scoped outbox row:

- trimmed `text` containing 1–10,000 characters;
- `workDate` as a real `YYYY-MM-DD` calendar date (years 0001–9999) or `null`;
- authorized `activityId` or `null`.

Inputs freeze as soon as confirmation starts, and the screen displays the persisted payload after saving. A lost response, app restart or reconnect retries the same capture/report identity and byte-for-byte JSON values. The production RPC returns the existing report for the same fingerprint and rejects a changed payload for that capture. SQLite migration adds confirmation, submission receipt, original transcript, saved activity label, rejection and evidence-release columns without replacing existing outbox records or their retryability.

There is one narrow correction path: the exact RPC error `42501 / Activity access denied` occurs after its submitted-replay check and proves the draft was not submitted. The app persists that rejection and requires the worker to correct/reconfirm before sending again. Auth, generic access and network errors do not prove rejection, so their payload stays locked. SQLite permits replacement only from the recorded rejection state before any receipt.

Offline confirmation stores the locked payload. Text-only reports reserve their stable capture on reconnect and submit that payload. **Sending for review** changes to **Awaiting review** only after a verified receipt; paused/failed attempts show the actual error. Submitted and accepted remain separate states. My reports keeps a link to pending and completed confirmations. Saved activity labels remain visible when live options are unavailable.

Confirmation and synchronization serialize per account/capture in the shared native service, including direct screen retries and automatic passes. Durable changes invalidate the open confirmation query, so offline saves lock immediately and foreground receipts appear without reopening the screen.

## Evidence lifecycle

Unconfirmed evidence remains in app-private storage. After a valid submission receipt, the app marks the server receipt durably and then deletes the original local voice/photo draft through the existing guarded store. The guard permits deletion only when the confirmed payload, report ID and receipt are durable. Foreground cleanup retries with bounded backoff, including after a direct retry wakes an idle coordinator. It does not resubmit a receipted report.

## Evidence limits

Unit, component and real SQLite integration tests cover payload validation, transcript display, input freezing, offline save/restart, concurrent receipt checks, immutable uncertain receipts, definitive activity rejection, current membership/activity reads, exact RPC arguments, guarded cleanup and foreground retry. These checks mock Supabase. They do not prove production membership, worker transcription, a live RLS mutation, physical-device keyboard/date entry or cross-client planner visibility. Validation results are recorded in the PR draft.
