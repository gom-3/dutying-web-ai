# Live autocomplete recovery — 2026-10-22

## Evidence and scope

Read-only production aggregate: last 14 days contain 94 autocomplete engine attempts: 63 ACCEPTED, 21 INFEASIBLE, 10 REJECTED. Client journey contains 17 CLIENT_APPLIED events, not a complete success denominator. Do not equate engine acceptance with user completion or infer a universal outage. Repeated failures still block affected teams.

Failure classes: nine no-assignable-OFF guards, six fixed-rest/exact-month-target conflicts, five solver infeasibilities, one staffing-capacity preflight. Ten prior-build candidates failed final hard-rule validation. Current strict replay rejects the representative prior-build candidate earlier, so removing validation is not a remedy.

## Confirmed defect

A full-month fixed nurse row is required to have an assignable OFF despite no cell needing generation. Two day-only configured rows already contain preserved D/O assignments for the entire month. The unconditional OFF guard prevents generating the other eleven rows. The allowed domain is relevant only to editable cells. Preserve every fixed assignment and do not widen any nurse's configured choices.

Repair: apply empty-domain/OFF guards only when the row has editable cells. Fixed rows use their existing assignments; independent final validation stays enabled. Regression must prove a fully fixed D/O row with D-only future eligibility no longer blocks generation, while a row with an editable cell and no OFF still rejects.

## Recovery-path gap

The explicit-consent implementation only attaches generation recovery after solver reason `infeasible`; deterministic preflight failures bypass this path. Supported stored staffing rules can conflict before the solver, yet users get no verified consent candidate. Route proven preflight conflicts through the same bounded exception verifier. Preserve original diagnostic and empty public patch; protected/month-rest/zero-count rules are not implicitly relaxed. Raw unstructured prose must not enter exception probing without independently verifiable semantics.

## Validation and release

Use synthetic committed regression fixtures plus anonymized local replay (no production names, original payload dumps, or settings changes). Verify original fixed cells, remaining hard rules, disclosed exception scope, no-consent/no-application and queue/budget bounds. No production generation replay. Previous consent PRs remain prerequisites for end-to-end recovery. No schema change. Manual production cutover requires the separate deployment-skill approval after concrete tested artifacts are ready.

## Implemented recovery and evidence

- Fully fixed rows no longer need a generative OFF/shift domain. A synthetic regression failed twice before the fix and now accepts both D-only and empty future-eligibility fixed rows. Partly editable D-only rows still reject.
- GENERATE and solve-v2 preflight staffing-capacity proofs can enter bounded consent probing. Individual forbidden-duty, fixed-rest, unsupported and unproven failures keep their original rejection; residual prose disables exception probing rather than silently losing intent.
- Spring maps scoped, numeric monthly-rest contradictions to `failure.restTargetConflicts` (nurse, minimum/maximum, fixed/available rest days). Web explains the values in Korean/English and provides the existing review action instead of blind retry. No protection or target setting changes occur.
- Five anonymized representative archived inputs replayed locally. All five still lack a strict solution under their original complete contract. Four now produce verified consent candidates (about 1.3–5.6 seconds in this local run), preserving fixed assignments and all non-excepted hard constraints. The fifth has fixed-rest/target contradictions and intentionally stays unapplied with actionable guidance. This is not evidence of production latency or ordinary strict success.
- The original no-OFF production example has another independent count constraint conflict after the fixed-row guard is corrected; it only becomes a usable consent candidate. Do not claim that the guard fix alone makes this exact input strictly feasible.

## Shared API addition

`AutofillRes.failure.restTargetConflicts` is optional and additive: `shiftNurseId`, `name`, `minimum`, nullable `maximum`, `fixedRestDays`, `availableRestDays`. Reason code `MONTHLY_REST_TARGET_CONFLICT`. The main server resolves names only from the current authorized scope, accepts only integral counts 0..31 and only actual contradictions. Web localizes these typed facts and never displays arbitrary internal exception text. Existing clients retain generic failure behavior. No migration.

## Local checks

150 focused Python tests; 161 focused Spring authoring/conversation/consent-store tests; 26 web failure/consent tests passed. Web TypeScript build, Python Ruff and the Spring↔Python adjustment contract checker passed. Counts are scoped suites, not entire repository coverage. Production cutover and authenticated live UI application remain unperformed.
