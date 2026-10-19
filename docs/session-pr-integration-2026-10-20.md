# Recent session PR integration — 2026-10-20

Scope: PRs created on 2026-10-19 only; develop source integration. Preserve existing billing checks and current develop behavior. Older Flutter/.net backlog and main release versions are excluded. No DB/Flyway change or deployment.

Merge the reviewed heads with ancestry preserved, resolve overlapping conversation metadata / plan refresh and UI priority controls without reverting the latest card design. Keep plan hash, fixed-cell and independent result validation gates. The production read-only inspection utility is backported separately; its main PR remains open.

Use one integration PR per repository. Local checks precede integration, and commit messages start with [skip ci] to avoid duplicate release runs. Development deployments need coordinated ordering: LLM priority receiver, Spring receiver, web consumer, then catalog producer. No paid model evaluation has been run; model quality and actual deployed behavior are separate checks.

## Validation

TypeScript passes. Full Vitest: 2355 passed / 3 skipped, with two 30-second UI-review timeouts under concurrent test load; the isolated UI-review file passes all five cases (including both timed-out cases) with unchanged timeout and assertions. Targeted ESLint passes after formatting conflict resolution.
Vite production build passes. The main-only 1.3.6 release UI is already present in develop; preserve the newer develop public-offer validation instead of importing release snapshot regressions.
