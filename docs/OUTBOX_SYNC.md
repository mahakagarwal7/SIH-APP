# Outbox and My reports contract

Roadmap 1.5 connects durable local capture to the existing production media contract. Roadmap 1.4 adds the separate confirmation boundary and the only mobile call to `submit_field_capture`; see [the confirmation contract](CONFIRMATION_SUBMISSION.md).

## Frozen local identity

Each local draft ID becomes its stable `captureId`. Before the first reservation the app reads every complete private file, computes SHA-256 over the actual bytes and atomically persists this manifest in `local_field_outbox`:

- one stable media UUID per file;
- original byte count, MIME type, safe filename and caption;
- project/account identity, capture kind, language and local creation time;
- server report ID and completed upload IDs as they become known.

SQLite uses WAL and `synchronous = FULL`. Its upsert condition refuses to change project, owner, draft content or manifest for an existing capture ID. In-process preparation is serialized per account. A changed/missing private file fails locally before upload.

## Production sequence

1. Recheck the active signed-in membership. Remembered project context only permits offline capture; it grants no server authority.
2. Call `reserve_field_capture` with the persisted capture ID and exact manifest. A lost response is safe because the RPC returns the same report for the same request and rejects capture-ID reuse with different content.
3. Upload each verified `ArrayBuffer` to `evidence/<project>/<report>/<attachment>` with `upsert: false`. A duplicate response is treated as a prior lost-success response; the immutable reserved path and worker SHA check still protect the bytes.
4. Call `finalize_field_media`. The server verifies object sizes and queues its media jobs.
5. Read permitted attachment/job/result fields while the foreground app is active. Ready media becomes **Needs confirmation**. Voice is never sent for review without checking the server transcript.

Foreground processing polls with bounded backoff and pauses offline/inactive. Sync now also retries paused access/auth items deliberately. Expired auth or revoked membership preserves local data and displays **Sync paused**. Terminal worker failure displays **Sync needs attention**. The app never calls worker-only RPCs or uses a service-role key.

The binary upload follows the [Supabase ArrayBuffer upload contract](https://supabase.com/docs/reference/javascript/storage-from-upload). Private files use the SDK-matched [Expo FileSystem byte API](https://docs.expo.dev/versions/latest/sdk/filesystem/).

## My reports states

My reports merges account-scoped local drafts, outbox rows and the signed-in author's RLS-filtered production reports by capture ID. It does not duplicate one capture across those sources.

- **Saved on device**: durable locally, not yet reserved.
- **Syncing / Processing evidence**: reserved upload or server media work remains.
- **Needs confirmation**: server media is ready, but nothing has been submitted.
- **Sending for review**: the exact confirmed payload is saved locally and locked while its server receipt is pending.
- **Awaiting review / Accepted / Partly accepted**: derived from an existing submitted report and its readable claims.
- **Answer needed / Supervisor check / Needs planner attention / Rejected / Kept as unplanned / Withdrawn**: preserved rather than collapsed into success.

The last loaded server data can remain visible offline, clearly labeled stale by the offline banner. Local drafts survive logout but stay hidden from other accounts. Capture screens block local deletion after an item enters the outbox so retry/confirmation cannot lose its evidence. Private evidence is removed only after the submission receipt is stored locally.

## Evidence limits

Unit/integration tests cover interruption, restart, duplicate upload, manifest mutation, account isolation, revoked access, worker retry/terminal failure and local/server list merging. Android/iOS/web exports establish bundle compatibility. They do not prove the local publishable key, production membership, deployed worker, transcription quality, physical connectivity or RLS behavior on a live account.
