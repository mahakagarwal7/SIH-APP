# Confirmation and submission contract

Roadmap 1.4 adds the explicit **Check → Send** boundary after roadmap 1.5 has reserved, uploaded and verified a field capture. The mobile app uses the existing production `submit_field_capture(p_report, p_text, p_work_date, p_activity)` RPC under the signed-in user's RLS context. It changes no schema, worker or web API.

## What the worker confirms

The confirmation screen keeps the verified original voice transcript read-only and places editable submitted wording beside it. Text/photo drafts start with their saved wording. The worker may add an optional ISO work date and select an activity from the current RLS-scoped `schedule_snapshot`; leaving either value unrecorded is explicit. The screen asks the worker to check names, quantities, dates and unfinished-work wording before enabling send.

The production contract has no pre-submit AI suggestion or separate partial-work flag. The app therefore does not invent either field. Partial or unfinished work stays in the confirmed wording, with a concrete prompt such as “2 of 8 complete; 6 remain unfinished.” The activity choice remains optional and the submit RPC rechecks its authorization.

## Immutable retry

Before the first submission attempt, SQLite stores the normalized tuple below on the existing account-scoped outbox row:

- trimmed `text` containing 1–10,000 characters;
- `workDate` as a real `YYYY-MM-DD` calendar date or `null`;
- authorized `activityId` or `null`.

Once stored, this payload is locked. A lost response, app restart or reconnect retries the same report ID and byte-for-byte JSON values. The production RPC returns the existing report for the same fingerprint and rejects a changed payload for that capture. SQLite migration adds confirmation, submission receipt, original transcript and evidence-release columns without replacing existing outbox records.

Offline confirmation stores the locked payload and remains **Sending for review** until a foreground reconnect verifies the RPC receipt. Only then does the row become **Awaiting review**. Submitted and accepted remain separate states.

## Evidence lifecycle

Unconfirmed evidence remains in app-private storage. After a valid submission receipt, the app marks the server receipt durably and then deletes the original local voice/photo draft. Cleanup is retryable and cannot cause a second logical submission because the confirmed payload and submitted receipt remain in SQLite.

## Evidence limits

Unit and component tests cover payload validation, transcript display, explicit confirmation, offline save, lost-response retry, immutable payload enforcement, current membership/activity reads, exact RPC arguments and post-receipt cleanup. These checks mock Supabase. They do not prove production membership, worker transcription, a live RLS mutation, physical-device keyboard/date entry or cross-client planner visibility.
