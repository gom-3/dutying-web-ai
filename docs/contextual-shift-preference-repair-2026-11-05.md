# Contextual shift preference repair — 2026-11-05

A shortage observation followed by a pronoun preference refers to the same nurse
when that referent is unique. Resolve the entire message before extracting clauses.
For negotiated authoring, express this as one SHIFT_COUNT INCREASE goal, current
month, OPERATION lifetime, preserving the complete source wording. Do not create
a month-wide ASSIGN or a hard quota. Ambiguous referents still need clarification.

Make negotiated authoring available by default, retaining explicit environment
opt-out and client/server version negotiation. The legacy review must preserve
already interpreted lifetime/severity, not solicit them again for every rule.
This also removes the path that promotes a soft-only preference to invalid HARD.
Execution still validates protected cells, staffing and existing hard constraints.

Production incident 26d9515e has HTTP 400 INVALID_PARAMETER before engine evidence.
Live log access failed due to expired AWS authentication; its precise cause remains
unverified. Source shows the unconditional severity question and backend rejection
of unsupported HARD; this is a reproducible defect, not a confirmed incident trace.
No schema migration. No production deployment is part of this change.

## Small relative changes

SHIFT_COUNT without an exact quota now saturates its request objective after one
occurrence of progress from the original roster. Existing soft-quality and change
minimization choose among improved schedules; no extra reward is given for pushing
the count to the change cap. Exact COUNT constraints are unaffected. Real CP-SAT
checks cover both increase (3→4) and decrease (3→2), each with a two-cell swap,
fixed-cell preservation and unchanged daily staffing. This is the default search
policy for relative requests, not an invented user-supplied exact quota.

Spring semantic execution/negotiated authoring and Python semantic preview/execution
defaults are enabled together. Existing explicit environment false overrides remain
effective; runtime rollout must verify all gates. Deploy Python before Spring to
avoid advertising endpoints on an older Python service. Web keeps server capability
negotiation; no forced client bypass.
