---
name: dutying-web-release-verify
description: Safely prepare, verify, or diagnose a Dutying web release. Use for web production deployment requests, provider deployment failures, main-not-reflected reports, public web outages, release branch verification, or confirmation that a frontend change is actually live.
---

# Dutying Web Release Verify

Treat a GitHub Release, a provider deployment, and a live browser experience as separate facts. Do not call a frontend release complete until the deployment provider reports the intended commit and the public site serves the intended change.

## Guardrails

- Read `AGENTS.md` and this skill before release work.
- Never read, print, commit, or copy `.env*`, provider tokens, analytics keys, or browser session data.
- Preserve existing worktree changes. Use a separate worktree for release-only edits if the active checkout is dirty.
- Require explicit user approval before an external-provider deploy, rollback, DNS change, or environment-variable change. Read-only GitHub, provider, browser, and public-URL checks are allowed.
- Do not treat the repository's GitHub Release workflow as proof that Cloudflare Pages or another external web provider has published the build.

## Release flow

1. Follow the repository release path: feature work enters `develop`, the release PR updates version/changelog, QA uses `release/<version>`, then the release branch enters `main`.
2. Before the release, run the relevant checks: `pnpm run release:verify`, `pnpm run type-check`, and targeted tests or `pnpm run test:run` for changed behavior. Build the affected app with `pnpm run build:app` when a release artifact needs inspection.
3. Confirm the external deployment provider reports the target Git commit, deployment state, target domain, and production environment. If its credentials or connection are unavailable, report deployment verification as incomplete rather than guessing.
4. Verify public endpoints and changed browser behavior. Use an authenticated browser only when required and never create or mutate production user data merely as a smoke test.

## Verify public delivery

Use the bundled read-only verifier for each public URL. Add an expected user-visible marker when the change has one.

```bash
.codex/skills/dutying-web-release-verify/scripts/verify-public-release.sh \
  --url 'https://dutying.ai' \
  --expect-text '<changed visible text>'
```

The script proves that the public response is reachable and includes the requested marker. It does not prove a Git SHA. Pair it with the provider's deployed-commit evidence and browser validation for route, login, API, or cache-sensitive changes.

## Failure and rollback

- If CI or GitHub Release succeeds but the provider did not deploy the target commit, treat the release as not deployed and investigate the provider integration.
- If the public URL is unhealthy after a provider deployment, first compare the provider's prior successful commit. Roll back only through the provider after user approval, then re-verify the public URL.
- Do not invalidate caches, alter DNS, or modify API environment variables as an unreviewed recovery action.

## Report completion

State the release branch/commit, tests, provider deployment ID and commit, target URLs, browser validation result, and any unverified provider state. Do not call a release live solely because a static URL returned `200`.
