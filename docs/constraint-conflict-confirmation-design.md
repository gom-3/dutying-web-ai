# Explicit conflict consent and Gemini-first adjustment

2026-10-22. User authorized existing Gemini credentials and prioritizes quality over API cost.

- Interpret natural-language requests with Gemini first. Pin Gemini 3.8 Flash in adjustment and draft settings; explicit env overrides remain possible. Do not infer faster latency from model identity.
- Residual prose adjustment calls the LLM before structured re-solve, avoiding a full solver wait before the first LLM call. Retain deterministic validation.
- On a proven infeasible result, probe bounded, persisted rule exceptions in priority order. Never alter fixed cells, accepted requests, annual leave, nurse availability or stored semantic request meaning. Candidates must pass the unchanged remaining hard rules.
- Spring independently validates candidate cells against original rules. A candidate is proposed only if every original hard violation is one of the identified exception rule IDs and every proposed change survived protected-cell/availability filtering. No candidate cells are applied before consent.
- Cache candidate, exception IDs and canonical execution-input digest in account/ward/team/month scoped Redis for five minutes. Response contains only token, expiry and original-rule violation descriptions. Yes resubmits token plus explicit true; server checks current input, membership and original rule validation, applies the cached candidate without another model/solver call. No returns to request editing. Rules are never persisted as relaxed.
- Audited response flag allows only this explicitly confirmed result through Spring/conversation/web gates despite listed hard violations. Original validation is returned so errors remain red. Other hard-invalid results remain rejected. No database migration.
- Start with count/pattern/staffing rules with known deterministic support; do not claim every infeasibility can be resolved. Probes share five seconds and yield to queued work.
- Tests: no-consent/no-cells; scoped token, stale input, protected changes and unrelated hard violation rejected; exact cached replay; UI Yes/No; Gemini configuration and LLM-first route; synthetic live interpretation eval only, no production nurse data sent for eval.

## Implemented scope and validation

- Candidates: up to two individual persisted-rule exceptions, then one combination (at most 32 known rules), sharing five seconds. Count-zero prohibitions, monthly semantic requests, nurse eligibility, fixed/accepted cells, annual leave, rest and maximum continuous-work rules are not relaxed by this implementation. Unsupported/raw residual prose does not authorize exceptions. Not every conflict gets a proposal.
- Model output is validated before use. Residual prose is applied first and its changed cells are held during the structured follow-up solve, so that solve cannot erase the prose request.
- No second calculation on Yes. A source-scoped five-minute cached candidate is revalidated against original Spring rules; all remaining HARD violations must be the disclosed exception rules, and no proposed cell may have been filtered by protected-cell/availability checks.
- No/expired/stale candidates return to request editing. A confirmed response includes `confirmedConstraintException`; other HARD-invalid responses still fail the web gate. HARD validation and red markers remain based on original rules.
- Consent-needed states are not ordinary incident-alert failures. Journey records retain the user-facing response. No stored rule changes or Flyway migration.

## Live synthetic Gemini checks (2026-10-22)

Existing development Gemini credential; isolated evaluation subprocess, no deployment or production nurse data. Dates/custom-negation structured extraction used current provider/facade source loaded only into the subprocess because the running dev image predates JSON-schema transport.

| Check | Results | Latency |
|---|---|---|
| Legacy interpretation, 3 synthetic cases, Gemini 3.5 Flash | 3/3 exact executable semantics | median 1,601 ms |
| Same 3 cases, Gemini 3.8 Flash | 3/3 exact executable semantics | median 2,410 ms |
| Structured semantic extraction, 6 synthetic date/negation cases, Gemini 3.8 Flash | 6/6 oracle checks | median 3,662.5 ms; range 3,151–4,042 ms |

Small-sample smoke checks, not a demonstrated accuracy gain or faster model. Gemini 3.8 Flash is selected for the user's quality-first preference. Speed changes are pipeline ordering, preservation of accepted prose patches, one shared probe budget, and cached consent replay. Unknown price estimates are not treated as zero cost.
Official availability: https://ai.google.dev/gemini-api/docs/models.md

Mixed rotation: baseline requests disable probes until permitted fallback is attempted. Spring caches and restores the verified stage before replay. Both conversation and legacy UI expose Yes/No; normal consent prompts do not emit failure alerts.

Stored HARD rules are no longer silently shadowed by a same-axis monthly request. Both rules reach the solver and original-rule validator; supported conflicts use the explicit consent path. Existing same-axis SOFT precedence remains.
