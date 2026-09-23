# Text and photo capture — roadmap 1.3

The owner approved the remaining delivery sequence and extended the existing
local-draft retention rule to text and photos on 24 September 2026. This slice
adds native text/photo capture and local persistence only. It does not reserve,
upload, finalize, transcribe or submit a report.

## Local contract

A report draft contains up to 10,000 characters and up to three photos. At least
one of text or photo is required. Each photo has an optional caption of at most
500 characters. Photos are decoded and re-encoded as JPEG rather than trusted by
filename or picker metadata. Normalization tries bounded 2048, 1600 and 1280
pixel passes with decreasing JPEG quality until the actual output is within the
production contract:

| Property           | Local and production boundary                  |
| ------------------ | ---------------------------------------------- |
| Format             | Actual JPEG bytes, `image/jpeg`                |
| Count              | At most three photos per report                |
| Size               | 1 byte through 5 MiB per photo                 |
| Decoded dimensions | Positive dimensions, at most 20 million pixels |
| Caption            | At most 500 characters                         |

The temporary picker location is never treated as durable. The normalized bytes
are copied under the app document directory at
`report-drafts/<user>/<draft>/<photo>.jpg`. SQLite metadata lives in
`nirmaan-drafts.db`, table `local_report_drafts`. IDs are generated locally and
validated before constructing paths.

Saving inserts a `saving` row, writes every private file, checks every actual
file size and only then commits `saved`. A failed write stays incomplete and
the screen retains the exact draft ID, text and photo bytes for retry while it
remains mounted. A text-only draft follows the same metadata commit. The UI
does not say **Saved on device** before the commit.

Draft reads, state changes and deletes bind the signed-in user ID. Logout does
not delete drafts; another account cannot list or discard them. Explicit
discard marks a tombstone, deletes each file and then removes metadata. Failed
deletion remains visible for retry. Clearing app data or uninstalling removes
the app-private drafts.

## Native behavior

The Report screen exposes Voice, Type and Photo methods. Type and Photo share a
form so a field report can combine wording, evidence captions and up to three
photos. Camera and library permissions are requested only when their actions
are used. Android `getPendingResultAsync` restores a picker result after the OS
recreates the activity; that result still passes normalization before it is
eligible to save.

`expo-image-picker` owns the system camera/library interaction and
`expo-image-manipulator` decodes, resizes and re-encodes output. The picker
configuration repeats the already approved microphone explanation instead of
blocking `RECORD_AUDIO`, preserving roadmap 1.2 voice capture.

The screen needs the signed-in user's loaded default project for a new draft.
Existing same-account drafts remain listable offline. Persistent project context
for a cold offline launch belongs to the outbox/project-cache work. Web displays
an unavailable state; native Android/iOS source is included, while physical
device behavior remains a manual validation item.

## Verification boundary

Unit tests cover durable ordering, incomplete writes, same-ID retries, text-only
save, empty/oversized/mismatched rejection, account isolation, deletion
tombstones, real SQLite parameter binding, normalized image boundaries and
multi-pass size reduction. UI tests cover save timing, actual normalized bytes,
captions, failed-save retry, empty drafts and stale account/project context.

Required repository checks are typecheck, lint, formatting, Jest and Android,
iOS and web exports. A native device check must additionally exercise camera
permission denial, library choice, Android activity recreation, three-photo
limit, low storage, logout/account switching, restart persistence and explicit
discard. No successful upload or planner visibility should occur in this slice.
