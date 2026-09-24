# Submitted report status contract

Roadmap 1.6 completes foreground delivery tracking after `submit_field_capture` returns. Realtime remains deferred because the reviewed migrations do not prove production publication for the required tables. The native My reports screen uses existing authenticated Supabase reads under RLS and changes no backend schema or policy.

## Read model

For the signed-in author’s 100 most recent reports, one refresh reads:

- `reports`: capture identity, lifecycle and receipt time;
- `jobs`: the latest visible extraction state (`queued`, `running`, `retry_wait`, `succeeded`, `failed`);
- `claims`: current review/follow-up outcomes, excluding superseded claims from the displayed status.

Claims and jobs are read in stable pages of at most 200 rows with exact counts. The reader fails the whole refresh if a page is missing, changes during pagination, exceeds the 2,000-row safety bound, or contains another report's ID. It never derives a final status from a silently truncated list.

## Honest states

- **Processing report**: the report reached production; claim extraction has not produced a current review item yet.
- **Waiting to retry**: production retained the report and scheduled another extraction attempt.
- **Processing needs attention**: extraction exhausted or ended in a terminal failure. The internal worker error code is not exposed as user guidance.
- **Needs review**: current claims exist and await a planner decision.
- **Answer needed / Supervisor check / Needs planner attention**: clarification, independent verification and disputed evidence stay distinct.
- **Accepted / Partly accepted / Rejected / Observed — schedule unchanged / Kept as unplanned / Withdrawn**: final outcomes remain distinct. Partial acceptance never implies full activity completion.

The UI keeps Saved on device, Sending for review, production processing, planner review and accepted outcomes separate.

## Polling lifecycle

My reports performs its normal initial/focus refresh, then polls only if at least one submitted report has a nonterminal outcome. The first check waits 5 seconds; subsequent checks use bounded exponential delays up to 60 seconds. A successful terminal result stops its timer.

Polling pauses when the app is inactive, the device is offline, My reports loses navigation focus or the screen unmounts. Returning to the screen or foreground starts a fresh bounded poll cycle. A failed refresh keeps the last known status, shows the existing refresh error and retries with backoff. No status work is promised while the app is closed.

## Evidence limits

Unit, service, hook and component tests cover status precedence, terminal detection, bounded backoff, inactive/offline pause, job/claim authorization boundaries and the distinction between extraction and review. Mocked Supabase reads do not prove production RLS, worker operation, processing time, cross-client visibility or a physical device’s connectivity transitions.
