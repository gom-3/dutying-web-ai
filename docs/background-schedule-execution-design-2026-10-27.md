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

The old synchronous route still returns 200; only Prefer: respond-async selects
202. Old backends ignore the header and keep their original response contract.
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
