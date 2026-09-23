# docs: document mobile design and backend integration review

## Summary

The mobile setup kit conflicts with the current web implementation in branding, navigation, native API authentication, audio formats, review decisions and export behavior. This change records the verified source contracts and open decisions before app implementation.

## Scope

- Read all seven original Markdown files and visually reviewed both supplied PDFs.
- Inspected web source at `c779472cced97006856cfc186c955f69ad7d15ab`.
- Added a product/design/contract review, TDD and signed-commit workflow, PR template and local artifact ignores.
- Recorded the owner's current remote-work authorization above historical setup-kit rules.
- Recorded the owner's production backend selection and exact local web environment variable names; the publishable/anon key remains to be supplied locally.
- At the discovery checkpoint, application implementation and APK generation had not started. Roadmap 0.1 is now tracked in `0.1-project-foundation.md`.

## Decisions and assumptions

Use the supplied Nirmaan visual language, subject to the pending brand/navigation choices. Do not invent tables, acceptance routes, server transcripts, production deployment, progress scores or successful synchronization. See the decision register in PROJECT_REVIEW.md.

## Validation

Documentation links, repository diff and ignore behavior are checked locally. The application typecheck/lint/Jest commands do not exist yet, so no application checks or CI success are claimed.

## Manual review

1. Read PROJECT_REVIEW.md, especially the decision register.
2. Nirmaan is confirmed as the mobile brand. Confirm field navigation, native transport and voice approach. The production backend is confirmed; supply the publishable/anon key locally in the web checkout's `apps/web/.env.local`.
3. Review the foreground offline-voice confirmation sequence.
4. Confirm iteration cadence and configure the owner's GPG signing identity.
5. Proceed to roadmap 0.1 once its dependent choices are resolved.

## Remaining work

At the discovery checkpoint, roadmap implementation, real Supabase connectivity, CI setup, GPG/GitHub write readiness and device/APK verification remained. No commit, push or remote PR had been made at that checkpoint. Follow the foundation PR draft for subsequent progress.
