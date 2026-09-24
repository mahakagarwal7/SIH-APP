# Outbox and My reports contract

Roadmap 1.5 connects durable local capture to the existing production media contract. Roadmap 1.4 adds [explicit confirmation and submission](CONFIRMATION_SUBMISSION.md), including offline text-only confirmation before reservation. Uploading evidence alone never submits a report for review.

## Frozen local identity

Each local draft ID becomes its stable `captureId`. Before the first reservation the app reads every complete private file, computes SHA-256 over the actual bytes and atomically persists this manifest in `local_field_outbox`:

- one stable media UUID per file;
- original byte count, MIME type, safe filename and caption;
- project/account identity, capture kind, language and local creation time;
- server report ID and completed upload IDs as they become known.

SQLite uses WAL and `synchronous = FULL`. Its upsert condition refuses to change project, owner, draft content or manifest for an existing capture ID. In-process preparation is serialized per account. Saving, preparing and discarding a capture share one per-account/capture lock; the native store checks for outbox ownership inside that lock before deletion. A changed/missing private file fails locally before upload.

## Production sequence

1. Recheck the active signed-in membership. Remembered project context only permits offline capture; it grants no server authority.
2. Call `reserve_field_capture` with the persisted capture ID and exact manifest. A lost response is safe because the RPC returns the same report for the same request and rejects capture-ID reuse with different content.
3. Upload each verified `ArrayBuffer` to `evidence/<project>/<report>/<attachment>` with `upsert: false`. A duplicate response is treated as a prior lost-success response; the immutable reserved path and worker SHA check still protect the bytes.
4. Call `finalize_field_media`. The server verifies object sizes and queues its media jobs.
5. Read permitted attachment/job/result fields while the foreground app is active. Ready media becomes **Needs confirmation**. Voice is never sent for review without checking the server transcript.

Each sync pass uses an account-bound transport. Every request obtains a token only for the saved capture's owner and retains that token for the request. Switching accounts during reservation/upload pauses subsequent requests rather than delivering evidence under the new account.

Foreground processing polls with bounded backoff and pauses offline/inactive. Durable saves and enqueues wake an idle coordinator; completing an explicit sync resumes automatic polling. Transient failures persist their retryability across restarts. Sync now deliberately retries paused access/auth items and restored local-file failures, including when an automatic pass is already running. Expired auth or revoked membership preserves local data and displays **Sync paused**. Terminal worker failure displays **Sync needs attention** and is not repeatedly finalized. The app never calls worker-only RPCs or uses a service-role key.

The binary upload follows the [Supabase ArrayBuffer upload contract](https://supabase.com/docs/reference/javascript/storage-from-upload). Private files use the SDK-matched [Expo FileSystem byte API](https://docs.expo.dev/versions/latest/sdk/filesystem/).

## My reports states

My reports merges account-scoped local drafts, outbox rows and the signed-in author's RLS-filtered production reports by capture ID. It does not duplicate one capture across those sources.

- **Saved on device**: durable locally, not yet reserved.
- **Syncing / Processing evidence**: reserved upload or server media work remains.
- **Needs confirmation**: server media is ready, but nothing has been submitted.
- **Sending for review / Check report / Sync paused / Sync needs attention**: a confirmed payload is waiting for a receipt, requires correction after a definite activity rejection, or needs attention to the displayed error. Pending confirmations remain accessible.
- **Awaiting review / Accepted / Partly accepted**: derived from an existing submitted report and its readable claims.
- **Answer needed / Supervisor check / Needs planner attention / Rejected / Kept as unplanned / Withdrawn / Observed — schedule unchanged**: preserved rather than collapsed into success. Outstanding clarification, verification and dispute take precedence over partial acceptance, matching the web report summary.

The server list currently reads the latest 100 authored reports. For those reports it pages through all readable claims using stable ID order and an exact count, advancing by the number actually returned so smaller server page caps are supported. Duplicate IDs, changing totals, incomplete pages or more than 10,000 claims fail visibly instead of producing a misleading acceptance summary. Remote-only attachment counts remain unknown and are labeled **Attachment count unavailable**.

The last loaded server data can remain visible offline, clearly labeled stale by the offline banner. Remembered capture context is used only offline; an online access/load error is shown even when a previous project remains cached. Local drafts survive logout but stay hidden from other accounts. Capture screens and native stores block local deletion after an item enters the outbox until a durable submission receipt permits evidence cleanup. Failed cleanup retries while the foreground app is active without submitting again.

Roadmap 1.6 reads production extraction jobs and claim outcomes with bounded foreground polling. See [the submitted status contract](REPORT_STATUS.md) for precedence, terminal states and pause behavior.

## Evidence limits

Unit/integration tests cover interruption, restart, duplicate upload, manifest mutation, account switches between network phases, deletion/preparation races, coordinator wakeups, revoked access, transient/terminal failures, claim pagination/status precedence, cached project errors and navigation during sync. PR #7 passed 206 tests in 36 suites; the integrated confirmation results are recorded in the PR #8 draft. Android/iOS/web exports establish bundle compatibility when recorded in the PR validation notes. These checks do not prove the local publishable key, production membership, deployed worker, transcription quality, physical connectivity or RLS behavior on a live account.
