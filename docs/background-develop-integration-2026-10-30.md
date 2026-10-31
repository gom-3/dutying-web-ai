# Background scheduling: develop integration (2026-10-30)

## Scope

Integrate the reviewed loading/background/conversation behavior into current develop without replacing newer first-request, grouped changes, timestamps, satisfaction, history or recovery features. Preserve original progress bar and typography. Keep close, reopen, cancellation and result reachable with one foreground progress surface.

## Vocabulary

Use 자동채우기 for generation, 수정 for an existing-schedule change, 근무표 for the roster, 신청 근무 / 고정 근무 for protected cells, 진행 상황 보기 for reentry, 결과 확인 for results. Keep technical operation/solver state names internal. Cancellation must say existing shifts remain and must not suggest closing cancels. Match existing product fonts and controls. Apply translations in ko/en/ja.

## Integration and validation

Merge current origin/develop into the feature branch and resolve conflicts by preserving current develop behavior plus the background connection. Re-run the affected conversation/editor/polling/failure test suites and type/build checks. Check real browser UI where available; record exactly which states and viewport were verified. Inspect workflow triggers before final push. User explicitly requested develop integration; no production deployment. Backend dependencies and unresolved validation discrepancies must remain explicit.

## Compatibility and current validation

- Keep current develop's 330-second synchronous operation timeout while sending Prefer: respond-async. An older server must not regress to a 17-second HTTP timeout. Polling for acknowledged background operations remains separate.
- A rejected, withheld candidate uses validation failure copy. A verified but unapplied result retains current develop's generic failure/revise treatment. Preserve both regression cases.
- Use the same 진행 상황 보기 wording in the loader and task entry. Existing-schedule updates use 근무표 수정 labels in progress/history/result entries; ko/en/ja distinguish generation and modification.
- Keep timestamps, grouped changes, first-generation request editing, result restoration and prepared-request recovery introduced on current develop.
- Browser component preview (synthetic data; not an HTTP E2E): desktop 1280x720 and mobile 375x812, separate messages and 44px cancellation target verified. Preserve Korean words on line wraps.
- Backend PR338 and Python PR158 remain separate open PRs. This frontend integration is not evidence of backend rollout or a complete deployment; actual async work requires the backend contract.

## Review

| Before                                                                   | After                                                              | Why                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------- |
| Loader and background entry use different labels for the same navigation | Both use 진행 상황 보기                                            | Predictable reentry                                |
| An ADJUST task says its autofill result is ready                         | 근무표 수정 labels for update status, results and accessible names | Distinguish creating and changing a roster         |
| Korean progress sentences split inside words on mobile                   | Preserve word boundaries with a fallback for long tokens           | Readability at 375px                               |
| Closing before the server acknowledges a request can leave no entry      | Keep a submission entry until an operation/result arrives          | Preserve a route back on older synchronous servers |

No production deployment or backend merge is included. Backend PR338 and Python PR158 remain open; actual asynchronous cancellation needs that backend contract.

## Final checks

- 95 schedule test files, 1,249 tests passed on the final integrated code.
- TypeScript project build and production Vite build passed; existing bundle-size warning remains.
- Changed product-code ESLint, Prettier and diff checks passed.
- Browser preview verified desktop and 375px layout; this turn did not rerun Spring/FastAPI end-to-end acceptance.
