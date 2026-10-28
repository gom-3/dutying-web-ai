# Monthly goals and minimum-night boundary parity

## Evidence and scope

The anonymized archived request reproduces a night-only row changing from N15/O15
to O30 after exact monthly rest for regular workers was introduced. Exact rest
leaves regular workers filling the entire daily soft staffing target. The current
objective ranks staffing excess above every personal monthly target, so the
night-only row's target disappears even though its allowed shifts remain correct.
Legacy ratio columns are not current policy: Spring removed target ratio mapping
in August (`NurseShiftType`, commit 7c82863b and the retired ratio specification).
Do not resurrect the removed feature from old database values. Current allowed
and preferred shifts plus staffing-derived monthly guidance are authoritative.

`fixed` is a saved monthly rest policy, not an unpersisted UI default. Preserve
`exactForRegularWorkers`, individual hard exact rules, locks and allowed shifts.
Do not infer a special monthly night minimum or relax exact to minimum.

An incoming last-month night followed by this month's OFF is another reproducible
failure: the solver allows it, the engine validator skips the prior-month run,
and Spring rejects its known closing OFF. A saved minimum 14 and maximum 3 are
contradictory for that incoming run. The stored minimum's origin is absent; there
is no evidence that it meant a monthly count.

## Change

* When hard monthly rest maxima are supplied, full-month generation protects
  existing personal monthly guidance: soft staffing shortages first, monthly
  guidance second, soft staffing excess third, then pending shift preferences
  and other balance/soft-rule terms. Hard rules/accepted requests/locks remain
  above every objective. Monthly guidance is inferred from available shifts,
  staffing supply, existing rest/capacity ceilings and preferred-shift rules;
  it is not an explicit personal quota and may be unmet when hard rules bind.
  No maximum rest contract means the legacy objective remains unchanged.
  Conflicting equally-SOFT staffing bounds over the same date/population/type
  retain the legacy symmetric cost; shortage is not silently favoured over max.
  ADJUST and two-shift priorities remain unchanged.
* This can produce additional staff when regular workers' exact work total
  already fills the daily soft target. Report shortages/excess and actual
  monthly counts together; N15 alone is not a correctness criterion.
* A minimum night run is judged when a known non-night/non-continuation cell
  closes it. Carry the count from known prior context; continuation display
  cells retain but do not increase it. An unfinished month-end run is open,
  because next month is unknown. Use this predicate in hard/soft encoding and
  final validation. Include the closing date in minimum-run violations.
* Feed known Spring blocking violations through the existing failure conflict
  contract, including actual/required values and dates. No additional UI card,
  fallback, retry, state machine, or repair stage.

## Validation and release

Use synthetic ID/month/headcount variants, ordinary wards, explicit exact rest,
saved availability/preferences, custom shift codes, locks, incoming/ending night runs and
contradictory minimum/maximum rules. Assert schedule counts and final verdicts,
not just payload flags. Replay the existing anonymized archived fixtures locally
with no LLM calls. Coordinate deployment with the release chat after PR review;
no production writes or parallel deployment. No schema migration.

## Local results and limits

* Existing six anonymized archives are reused, including the corrected 44 known
  carry cells. No nurse/team/month-specific conditions exist in the patch.
* Current-policy replay 182: N15/O15 on the restricted row; ten regular rows
  remain at exact O9; all 30 locks remain, 11 rows have 30 entries, staffing
  shortages are zero. Total work 225 versus daily soft target total 210: excess
  D7/E2/N6, 15 assignments total, daily work 7–9. This is a visible tradeoff,
  not a claim of exact daily staffing. No obsolete ratio fields are consumed.
* The same request still has a rotating four-night run. There is no HARD
  maximum-consecutive-night rule in archive182. This patch does not invent
  that rule, and does not claim to solve that separate expectation.
* Replay215: INFEASIBLE, no changed cells; minimum14/maximum3, incoming actual1,
  2026-10-31–2026-11-01. No N15 criterion applies to contradictory input.
* Engine: 280 passed, one pre-existing expected failure across boundary, monthly
  rest, full-month balance, staffing single-owner and draft contract tests.
  Spring: 202 passed. Web: 85 passed in existing failure/provider/conflict flows;
  TypeScript application type-check passed with this worktree’s installed workspace dependencies.
* Preserve the existing fixed month-start N guard when prior history is unknown;
  a known incoming N does not receive that exemption. Known closed carry runs
  include their current-month closing date in engine evidence.
* Development deployment and live UI QA remain pending independent review.
  The release owner should deploy Engine + Spring + Web once, then reuse the QA
  ward with identical input/carry. Check the known conflict's actual dates and
  counts in the existing failure flow; verify no changed cells were applied.

Policy review note: monthly guidance is currently soft quality guidance, not an
explicit personal request. Moving it above staffing excess is proposed behavior,
requires independent review, and must not be described as a fully approved
production policy. The conditional exact-rest and symmetric-conflict handling
are included in that review. Live deployment/UI evidence is still pending.
