# Observed night boundaries and authoritative scheduling inputs

## Final contract

* Explicit HARD rules, locks, exact monthly rest and availability remain protected.
  Existing explicit SOFT staffing shortage/excess costs are symmetric, followed
  by pending requests and inferred balance guidance. The proposed global policy
  toggle and monthly-guidance promotion were removed. Equivalent global and
  individual staffing encodings must have the same priorities and cost.
* A minimum-night run has an exact observed count only if its start follows a
  known non-night and its end is closed by a known non-night. Unknown earlier
  history makes the observed suffix a lower bound; it cannot prove minimum-run
  infeasibility. The solver can complete that unknown initial length, while
  mutable new nights still respect the same HARD maximum. Protected historical
  excess is not converted into a new blocking violation merely by losing data.
* Python and Spring use the same minimum-night closing date and affected shift
  scope. For known O on10/30, N on10/31–11/02, O on11/03, actual=3 and comparison
  suffix is [[211],[2026-10-31,2026-11-03],[303,304]]. Continuation display cells
  preserve the run without increasing its count or becoming an affected N.
* Original configuration proof uses the existing solver.conflictEvidence field.
  A permitted operational-exception candidate remains CONSENT_REQUIRED; original
  proof appears beside its actual remaining violations in the existing warning
  list. Outcome/delta, explicit concessions, cached tokens and approval rules
  are not relaxed. SATISFIED requestState does not override the consent state.
* Inferred monthly OFF guidance is compared with actual candidate counts in
  unmetInstructions. It is not reported as achieved work or as a proven blocker.

## Reused evidence and remaining limits

Archived182 still returns ACCEPTED with dedicated N0/O30 under the explicit
SOFT EXACT staffing and regular exact O9. It is not fixed by changing objective
weights. Its response now names actual O30 versus inferred O15; fixed30 cells,
allowed shifts and exact rest remain protected. The automatic fixed-policy to
exact-rest interpretation remains an unresolved product-contract question; this
patch neither redefines it nor resurrects retired nurse ratio weights.

Archived215 has observed last-four-day N/O/O/N, so the final N starts after a
known O: incoming actual1 is exact, min14/max3 is a proven conflict. Legacy
returns INFEASIBLE/change0. The negotiated path may offer a consent candidate
with the same original proof and actual remaining violations; it never
constitutes an automatically applied original-rule solution. By contrast,
[unknown,N] is not a definite incoming1 conflict; a protected historical N14
completion closed by current OFF is allowed.

Validation is focused on the existing counterexamples, minimum-night validator,
comparison metadata and the necessary anonymized182/215 runs. No new setting,
UI card, hospital-specific rule, source-data edits, LLM call, merge or deployment.
All PRs remain draft pending parent review and coordinated live dev UI QA.
