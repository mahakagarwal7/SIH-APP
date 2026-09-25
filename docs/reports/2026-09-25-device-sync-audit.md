# Connected-device sync and UI audit — 25 September 2026

## Scope and environment

One follow-up mobile PR to #38, including the owner's additional UI cleanup.
Production test reports were explicitly authorized. The connected I2301 phone
runs Android 15. Testing used ADB/UIAutomator and native screenshots for the APK,
and authenticated Playwright for the production web comparison. Playwright does
not control the native Expo UI.

All installs were in-place updates to `com.mahakagarwal.nirmaan`. App data was
not cleared. The original 7.3-second recording and existing user drafts were
preserved. A private backup of draft SQLite/files was taken before testing.
Screenshots, private backups and raw diagnostic data remain outside Git in
`C:/Users/Mahak/outputs/nirmaan-device-audit-20260925`.

## Findings and corrections

| Observation                                       | Verified cause / result                                                                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APK did not match merged source                   | Original installed package matched the older `866de57` build. A downloaded main APK from `3e77ae5` was installed for comparison. CI publishes build artifacts; it does not install an APK on an existing phone.                          |
| My reports failed and voice stayed at preparation | A persisted submitted receipt dated `2027-08-12` failed the newer future-date entry check during outbox hydration. That single row blocked all outbox reads. Stored-receipt validation is now separate from new confirmation validation. |
| Local read error hid unrelated server reports     | Local stores now settle independently, retain available records, show a retryable partial-read warning and coalesce local/server identities.                                                                                             |
| Voice said transcribing before upload could start | Preparation failures and failed/paused delivery are shown even after early Submit. Waiting for upload, connection and server transcription are distinct states.                                                                          |
| Home actions lacked cards and wrapped incorrectly | Expo Router Slot rejects style arrays on Link children. Flattening those styles restores the intended action cards. Tests now use the actual Slot.                                                                                       |
| Fifth manager tab exposed `review/[claimId]`      | A nested Review stack keeps detail routes inside the Review tab. Actual Expo Router regression test asserts four tabs on detail and return.                                                                                              |
| Empty My work appeared inconsistent with web      | This planner account has zero personal assignments; production has 149 schedule activities. My work now explains that difference and links planners to the schedule.                                                                     |
| Missing progress displayed as 0%                  | Missing accepted percentages remain unknown. Explicit zero and accepted finish are handled separately. Aggregate progress is unknown when its inputs are incomplete.                                                                     |
| Disabled manager actions gave no explanation      | Review now identifies missing reason/activity, unavailable state, mismatch and validation requirements without bypassing those controls. Related project views are invalidated after decisions.                                          |
| Confirmation buried Send below 149 activities     | Activity selection starts collapsed, searches names/codes/locations and displays at most eight matches.                                                                                                                                  |
| Excess spacing and inconsistent controls          | Compact shared branding/project controls, rounded cards/actions, smaller voice capture area, readable manager heading, clearer report labels and removal of obsolete implementation copy.                                                |

## Observed device and production results

| Check                      | Result and evidence                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native development build   | `npm run android -- --device I2301 --port 8081` completed and installed. Expo CLI required the model selection, not the raw ADB serial.                                                                                                                            |
| Existing data after update | Original voice draft and other saved evidence remained visible. My reports no longer fails from the historical work date.                                                                                                                                          |
| Text QA-A                  | Phone submitted report `a5c7943a-41fa-4f70-9066-878b987553f0`; exact QA wording appeared in web My reports. Extraction later failed with `provider_invalid_schema`. Submission succeeded; extraction is not marked passed.                                         |
| Native voice               | A new 11.1-second mono 16 kHz PCM16 WAV was recorded and saved. Local WAV structure/size checked: 355,244 bytes. Media job later became ready; verified transcript reached the outbox and its queued Send submitted report `2e9f51b0-d359-4a64-891b-90e44929ddb4`. |
| Voice accuracy             | The microphone captured ambient speech rather than the laptop's intended synthetic QA phrase. Transcription delivery was observed; controlled phrase accuracy is not claimed.                                                                                      |
| Native photo               | Camera captured a blank surface; marked QA caption saved; attachment's media job became ready. No private personal photo was selected.                                                                                                                             |
| Offline restart            | With Wi-Fi and mobile data disabled, QA-B saved locally. After force-stop/restart it was still present. Reconnection reserved report `882f3288-011c-4080-be9a-fc76cdcef13e` and exposed confirmation. Wi-Fi and mobile data were restored.                         |
| Manager navigation         | Opened Overview, Review and a real claim detail; the detail retained four tabs. Existing claims were inspected, not accepted/rejected.                                                                                                                             |
| Automated regression       | 80 suites, 590 tests passed; typecheck, lint and format check passed. Android/iOS/web export passed before final copy/layout polish.                                                                                                                               |

A development-only SQLite handle error occurred during Fast Refresh. A clean
process restart restored recording without deleting data. It is recorded as a
development-runtime observation, not a verified release APK defect.

The test account was a planner using both workspaces. Zero own assignments and
zero supervisor-check assignments are confirmed empty results. No invented
assignments or schedule approvals were used to make those screens look populated.
Web reports awaiting review and mobile unresolved claims count different entities.

## Worker hosting recommendation

Supabase already stores reports, private evidence and job queues. Processing
requires the existing backend program in `SIH-122/apps/worker`. The worker later
processed media during this audit, so it cannot be described as permanently
absent. Its host and continuity are still unknown; some extraction jobs remained
queued while the no-progress QA text failed schema validation.

For the existing implementation, use a continuously running **Render Background
Worker** connected to the backend repository. It already polls Supabase; another
queue service is unnecessary. [Render worker documentation](https://render.com/docs/background-workers).

Suggested configuration to wire after confirming the currently running worker:

| Setting                  | Value                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Repository               | Backend `SIH-122`, not this mobile repository                                                                                  |
| Service                  | Background Worker, Docker runtime                                                                                              |
| Dockerfile               | `deploy/Dockerfile`                                                                                                            |
| Docker context           | Repository root                                                                                                                |
| Docker target            | `worker` (the existing final stage)                                                                                            |
| Command                  | Existing Docker `CMD`: Node + tsx + `apps/worker/src/index.ts`                                                                 |
| Public environment       | `SUPABASE_URL` for the existing production project                                                                             |
| Server-only secrets      | `SUPABASE_SERVICE_ROLE_KEY` and the selected provider's API key, entered in host secret settings                               |
| Provider settings        | `EXTRACTION_PROVIDER`, its model, and `TRANSCRIPTION_PROVIDER`/transcription model from the backend's supported configuration  |
| Operational verification | Check heartbeat/logs and watch a marked job move queued → processing → ready/submitted; confirm recovery after service restart |

Verify the deployed backend revision/provider configuration before enabling a
second worker. Do not copy private worker secrets into the mobile repo or APK.
No hosting resource was created or charged during this mobile task.

Supabase Edge Functions are not a drop-in host for this program: they have
bounded lifetimes/CPU and do not support its `sharp` image-processing dependency.
A move there would require a separately reviewed backend rewrite.
[Supabase runtime limits](https://supabase.com/docs/guides/functions/limits).

## Delivery verification

Application source: `157b70f8a484cac9deea16fae5aa550bb941ecad`, preceded by report
recovery commit `2894658`. Both commits verified locally with the owner's GPG key.
The standalone ARM64 build completed with the bundled JavaScript, expected
package ID and approved Android debug certificate verified by the build helper:

- File: `nirmaan-157b70f-arm64.apk` in the private audit output directory (also
  `dist/nirmaan-field-preview-arm64.apk`).
- Size: **58,890,887 bytes**.
- SHA-256: `f514f901a5336166a427fe0e65e7e465880562702bf568a225a2e3707d0d766a`.
- Embedded source: `157b70f8a484cac9deea16fae5aa550bb941ecad`. Subsequent commits
  currently contain documentation and test formatting only.
- PR: [#41](https://github.com/mahakagarwal7/SIH-APP/pull/41). All three initial branch commits were verified
  by GitHub as well as locally.

The first PR CI run correctly rejected an unformatted updated test assertion;
`f85884b` formats that assertion. [CI run 36143862794](https://github.com/mahakagarwal7/SIH-APP/actions/runs/36143862794)
passed quality (including all-platform export) and Android helper checks. The
APK job is deliberately skipped on PRs; main builds it after successful quality
checks. PR #38's main CI was canceled by the subsequent merge; main's later
CI and automatic APK job both passed in run 36134006575.

The standalone APK was installed in place and rendered without the Metro USB
forward. Account displayed **Source 157b70f8**; English/Hindi switching worked.
The debug APK was then restored in place, USB forwarding restored, and a fresh
React Native DevTools session connected to the phone for the owner's debugging.
The standalone file remains available separately. Neither install cleared drafts
or the signed-in session.

## Restoring USB debugging

During the audit the development phone showed **Unable to load script**. Metro
was unresponsive, then its cache rebuild and a localhost-only IPv6 listener
prevented the USB-forwarded IPv4 connection. Android Studio remained running.
The following development server configuration restored the HTTP status endpoint:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
npx expo start --dev-client --host lan --port 8081 --max-workers 2
```

Set `adb reverse tcp:8081 tcp:8081` for the connected device, reload the debug app,
then press `j` in that Metro terminal to open React Native DevTools. Add `--clear`
once if Metro reports an unreadable cache. The standalone preview APK includes
its JavaScript and does not need Metro. After the owner unlocked the phone, the
app rendered again and Metro listed the phone's active Hermes target. DevTools
opened with the title **Nirmaan (vivo I2301)**. Switching temporarily to the release
APK disconnected the old debugger as expected; the debug build and fresh session
were restored afterward.

Full manager acceptance, clarification/verification mutations, alternate-role
RLS denial, long-duration recording, and controlled transcription accuracy are
not claimed as tested. No production schedule was changed for QA.
