> Current implementation (2026-10-28 UI correction): restore the original estimated progress bar, percentage and typography; add compact footer actions; append separate observed-phase assistant messages. The earlier phase-only proposal and initial verification below are historical and superseded by the UI correction section.

# Background schedule execution — 2026-10-27

## Problem and scope

Browser HTTP deadlines must not terminate a long nurse roster computation. Reuse
persisted conversation operations, revisions, idempotency keys, request guards,
checkpoint receipts and final validation. Existing synchronous execution remains
compatible; new web clients request async execution using Prefer: respond-async.
No database schema change is required.

## Contract

POST existing /conversations/{id}/operations with the opt-in header returns 202
and the existing operation receipt immediately after a short reservation transaction.
A bounded Spring worker (one active, four queued) computes using the authenticated
principal captured at submission. Queue residence does not consume compute time.
GET operation/detail exposes progress {phase: QUEUED|COMPUTING|VALIDATING, elapsedMs}.
Existing executionStatus remains RUNNING until checkpoint/finalization, preserving
all duplicate-operation guards. Cancel marks the durable operation CANCELLED and
prevents checkpoint/finalization from applying a late result. A running remote
solver drains within its bounded budget; cancellation never frees its slot early.

The server alone enables BACKGROUND execution in its engine payload. Python uses
at most 240 seconds total, 120 seconds for primary optimization and 60 for the
existing secondary search, preserving all rules and concessions. Fast cases stop
early. Legacy foreground 30-second optimization and intent-first 15-second budgets
remain unchanged. All modes retain bounded serialized CP-SAT resource admission.
HTTP engine transport remains below its existing 300-second envelope. No paid
providers, API key changes or production fixtures are needed.

Completed candidates pass the same Python and Spring checks and source/revision
checks as today. A stale result is saved without replacing current edits. No
candidate is ever invented and timeout is not proof of impossibility. Stopping the
web poll or closing the page does not cancel server computation. Frontend polling
continues while an operation is active; network failures show a reconnect state,
not completed calculation. Reopening the editor resumes from durable operation
history and browser pending receipt. Cancellation and duplicates cannot apply twice.

## Operational limits

The Spring queue is process-local; durable operation/receipt recovery survives
browser closure but does not promise process restart continuation. Existing lost-
worker recovery marks old operations unconfirmed/failed after ten minutes instead
of replaying solver work. Queue overflow terminates that reserved operation with
an explicit busy result; it never silently falls back to duplicate synchronous work.

## Verification

Unit and HTTP tests cover immediate acknowledgement, work lasting beyond 30 seconds,
foreground compatibility, authentication propagation, bounds/overflow, idempotency,
queue cancellation, late results, stale revisions, original final validation and
polling network recovery. Browser checks exercise visible running state beyond
30 seconds, eventual completion, cancellation/reentry and fast existing generation.
Use synthetic rosters and local harnesses; do not claim production deployment.

## Rollout and recovery compatibility

The old synchronous route still returns 200; only Prefer: respond-async selects 202. Old backends ignore the header and keep their original response contract.
The new Spring client recognizes only the exact old-engine 422 schema rejection
for remainingBudgetMs <=15000 and retries once with the original foreground wire
shape. This happens before solver admission, not after failed computation. Other
422 responses and computed results are never replayed. Deploy Python, then Spring,
then web for full extended-search support; mixed versions retain old limits safely.

Browser remount compares cells/fixed flags, ordered nurse IDs, division boundaries
and prior-month cells against the source. Rank magnitudes (0..5 vs 1024..6144) may
change during restore without changing seniority; they are not a source change.
Actual row reordering remains a source change. Original and negotiated pending
receipts both rebind only after this complete comparison.

## PO/PM UI review correction (2026-10-28)

Release remains blocked. The previous component fixture omitted the parent page busy callback and existing loading overlay. The production index still renders AiAutofillLoadingOverlay while executionBusy is true. Closing the panel expands that overlay across the whole page, preventing access to the reopen button. The simulated percentage is elapsed-time based, not solver progress. No production UI fix has been made for these findings.

See client-background-schedule-product-review-2026-10-28.html for reconstructed AS-IS, current PR, proposed TO-BE, and acceptance criteria. The proposal preserves the initial loading presentation, defines explicit hide-versus-cancel behavior, and requires a reachable ongoing-task entry after hiding. It is a review specification, not implemented functionality or deployment evidence.

## Approved UX implementation direction (2026-10-28)

The user requested implementation of the TO-BE while preserving the existing loading card and reducing sidebar boxes. Use one execution surface at a time: the existing central loading card on start; a plain conversation update when explicitly opened; a persistent, reachable task strip after hiding. Closing either surface never cancels work. Cancellation uses the same sidebar-owned API path and durable guards. The strip remains available for completion, cancellation, failure and source-changed results. Reopening never submits a new operation. The conversation stays mounted to poll even while hidden.

For background operations, preserve the existing card/icon and completion animation but replace the simulated percentage with server phase and elapsed time. Legacy synchronous loading retains its existing behavior. The sidebar uses ordinary conversational text and the existing decorative dots; no token simulation or invented solver reasoning. The parent receives the latest operation and a stable cancellation action from the sidebar. Starting a conversation execution closes the sidebar so the central loader and sidebar are not shown together. Hiding releases the overlay; editing the underlying draft remains protected by the existing immutable-source checks. Verify the real AiAutofill parent, not a hand-built calendar/sidebar wrapper; use synthetic local data and clearly label any controlled API latency.

### Implementation verification

The real AiAutofill parent was mounted against the isolated synthetic HTTP host. Verified >30s completion (51.10s, 186 cells), hiding/reopening without another execution, X returning to the task strip, cancelled late-result suppression with all 186 displayed cells unchanged, foreground completion/result opening (46.41s, one cell), and source-changed suppression for an actual one-cell patch after a manual edit (46.21s). Existing central card/icon and finishing animation remain; the background percentage is replaced with true phase/elapsed labels. The sidebar progress message no longer has a colored card.

Additional case: rewriting the manually modified source triggered PYTHON_SPRING_DELTA_MISMATCH / PYTHON_CONTRACT_UNVERIFIED and durable FAILED/NOT_APPLIED. This UI change does not resolve that server contract mismatch. The frontend previously paired the failure heading with a success-like SATISFIED message; the mapper now describes a withheld FEASIBLE/NONE positive-request outcome as a validation failure. Original validation/application gates are unchanged. The PR remains Draft; no production deployment. Browser viewport override did not change the actual 1280x720 viewport, so 375px verification is explicitly unclaimed.

## UI correction requested by the user (2026-10-28)

Restore the original loading card's progress bar, percentage, typography and description, rather than retaining only its icon. Keep the existing estimate behavior and label it as estimated progress; add only compact footer actions for background, conversation and cancellation. Remove the large primary button and the extra phase/elapsed paragraphs.

Conversation progress must be append-only assistant messages for observed queue, compute, long-running and validation states. Do not replace one status paragraph. Keep prior messages through hidden/reopened views, terminal results and remount. Persist only bounded event codes in session storage scoped to owner/team/conversation/operation. Never invent an unobserved phase. Reuse existing AssistantMessage typography and icon with an optional plain variant; preserve all other message styles.

### 새 브라우저의 기능 설정 초기화 순서

실제 부모 페이지를 처음 열면 workspace 응답의 기능 설정을 적용한 직후 editor init이 reset을 호출해 conversation/semantic 설정이 false로 돌아간다. 에디터 hydration 완료 후 같은 서버 응답의 기능 설정을 적용한다. 서버가 비활성화한 기능은 계속 비활성화한다. 새 상태에서 서버 true/false 모두를 회귀 검증한다.
