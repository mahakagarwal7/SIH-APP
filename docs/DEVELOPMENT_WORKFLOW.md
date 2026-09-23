# Mobile development and delivery workflow

23 September 2026. This workflow records the owner's current request. Implementation-dependent choices remain in [the review's decision register](PROJECT_REVIEW.md#decision-register).

## Current authorization

The owner explicitly authorized local commits, pushes and PR creation in SIH-APP, major features through PRs, and small fixes/features directly to main where repository rules permit. This supersedes the older setup-kit prohibitions on remote actions. It does not authorize disabling branch protection, rewriting remote history, deploying a backend, or changing the web project's contracts without discussion.

All commits must use the owner's GPG signature. Do not add Codex or other assistant co-author trailers. A signing failure is a blocker for commit/push, not permission to create an unsigned commit.

Continue implementation in bounded roadmap slices, completing tests and notes before beginning the next. The choice to continue automatically between slices is pending. Until answered, complete one approved slice and report. No PR merges are authorized by this document.

## Feature and small-change lanes

| Change                                                                                                   | Lane                                                                             |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Auth/session behavior, offline delivery, capture, project hierarchy, manager review, schedule or exports | Feature branch and PR                                                            |
| A bounded copy/style correction or similarly small change with no contract/auth/storage impact           | Signed direct-main commit is allowed if repository rules permit                  |
| Backend schema, native recorder/build approach, navigation or product scope                              | Present a concrete proposal; wait for the owner's decision before dependent work |

For feature work use `feature/<roadmap-step>-<slug>`. Build one reviewable slice at a time; do not accumulate unrelated work. Major-feature PR grouping and any dependent PR base must be explicit. A child PR's code must not be presented as independently reviewed when its base contains unmerged work.

Keep a local draft at `docs/pr-drafts/<slug>.md`, using [the PR template](../.github/pull_request_template.md). Push only reviewed project files; stage explicit paths. The two supplied PDFs remain owner-provided design references and must be intentionally reviewed before staging.

## Test-driven loop

1. Identify the slice's observable behavior, relevant design pages, real contract and failure modes.
2. Write a focused failing service/hook/state-machine test and run it. Confirm it fails for the intended behavior, not a missing test runner or broken import.
3. Implement the smallest working behavior.
4. Run that test, then refactor while it remains green.
5. Verify interactions where behavior crosses boundaries: session changes, reconnect, duplicate retries, interrupted upload, stale decisions or revoked membership.
6. Run the full required checks once the slice is complete:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
```

7. Run a bundling/build check appropriate to native dependency changes, and compare the changed screen with the relevant PDF pages.
8. Record exact results and remaining manual checks in the slice's PR draft.

Jest and React Native Testing Library cover logic and meaningful interactions. Network mocks do not prove RLS or end-to-end connectivity. Live authorization/contract tests use an agreed staging project or isolated local stack with distinct roles; never an unapproved production mutation.

## CI to implement in roadmap 0.1

Use a pinned supported Node runtime and lockfile. A GitHub Actions workflow on PRs and main pushes will install with `npm ci`, then run typecheck, lint, format and Jest. Add an Expo bundling check after the scaffold can bundle. Workflows should have read-only repository permissions by default.

Do not add green placeholder checks, skip tests to get a green run, or claim CI has run before observing the result. Roadmap 0.1 adds the application package and CI workflow. Record local checks and observed remote runs separately.

Live backend and physical-device checks remain separate named evidence. A mocked login or successful TypeScript build is not an end-to-end pass.

## GPG and GitHub readiness

Updated local observation, 23 September 2026: Git identity and commit signing are configured. GnuPG lists the owner's RSA signing key ending in `831C481EF8506935`, with the configured commit email. GitHub CLI is not on PATH. Local commit verification, GitHub signature verification and remote CI remain separate checks.

Before the first commit:

1. Identify the owner's existing signing key, or guide interactive generation with a passphrase kept outside chat and the repo.
2. Register only its public key with the owner's GitHub account and confirm the associated commit email.
3. Configure signing locally for this repository.
4. Stage reviewed paths and inspect the staged diff, including ignored secret/build artifacts.
5. Create a conventional commit with `git commit -S`, then verify locally with `git verify-commit HEAD`.
6. Push the authorized branch and check that GitHub reports the signature as verified. A local signature alone is not proof of the GitHub badge.

[GitHub signature verification documentation](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification) explains the distinction.

Do not generate an unprotected private signing key, disable signing, forge a Verified claim, or export private key material into this project. APK signing is a separate Android credential; GPG does not sign an APK.

Commit format:

```text
feat(field-reports): persist confirmed reports before upload

Describe the behavior, rationale, and any approved assumptions.
Explain added dependencies or files outside the target layout.

Refs: ROADMAP-1.5
```

For multiline PR bodies, use the draft file as the body source. Feature PRs describe the final behavior, contract, evidence, remaining limitations and manual device checks. Keep them open for owner review.

## End-to-end evidence for the field-reporting feature

Use synthetic records in the agreed environment:

1. Sign in as a scoped reporter; restore the session after app restart.
2. Confirm another project's records remain inaccessible.
3. Select authorized work; capture text/photo and the chosen supported voice format.
4. Enable airplane mode, save, kill/reopen the APK, and prove the draft/media remain.
5. Reconnect; prove duplicate retries produce one capture/report and preserve the original files.
6. For voice, wait for verified transcription, review/edit and explicitly submit.
7. See the same pending report on the planner web app.
8. Complete clarification/independent verification when required; preview and accept as a planner.
9. Observe Accepted or Partly accepted in the APK and the exact authorized schedule update on web.
10. Check failed processing, expired auth, revoked membership, denied camera/microphone access and stale review recovery.

No fake report success, illustrative counts or bypassed approval controls may substitute for these checks.

## APK delivery

Agree on package ID, build owner/environment and Android signing-key custody before creating the distributable identity. Evaluate the native recorder against that build path before promising Expo Go compatibility.

Use an explicit APK build profile for installable previews. EAS defaults to Android App Bundles, which cannot be directly installed like an APK; see [Expo's APK guide](https://docs.expo.dev/build-reference/apk/). A cloud build needs its account/project setup; local Android builds need a verified compatible JDK/SDK toolchain. Neither is assumed configured from folder presence alone.

Record source commit, environment, build identifier, artifact checksum and installation/device results. Unit tests, mocked integration, bundling, emulator tests and physical-device tests are distinct evidence. The final handoff must say which were actually performed.
