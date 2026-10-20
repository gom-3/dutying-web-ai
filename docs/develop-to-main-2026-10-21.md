# 2026-10-21 develop promotion impact

Merge develop into current main while retaining published release history. Release 1.3.9 includes rest preview month navigation, exact regular-worker off targets, and rejection of hard-invalid AI drafts. Preserve 1.3.8 adjustment loading fix; consume its duplicate develop changeset without repeating its release note.

No API endpoint or environment changes. The optional exact rest flag is backward-compatible but requires the new engine/backend for enforcement; release after both servers. Existing night-only policy and explicit annual-leave requests remain separate.

Run release verification, app type check, full app tests and production build on the merged tree. Cloudflare Pages is independent of GitHub Actions; verify provider commit and public delivery separately.

Integrated validation passed: release verification/version generation, TypeScript, 248 test files / 2,361 tests (3 pre-existing skips), and production app build. Existing bundle-size warning remains.
