# Japanese autofill recovery

The Japanese locale explicitly registers the English `aiAdjust` namespace. Provide a complete Japanese namespace with compile-time shape parity and tests for key/placeholder parity. Preserve user-entered rule labels; localize system explanations and recovery actions. Do not replace concrete server conflicts with generic translated failure text.

Validate the identified historical request without HTTP apply/approve or database writes, using the running engine's pure preflight/solver/diagnosis functions. A rejected request with a verified recovery proposal is distinct from a successfully generated roster. The original staffing contradiction must remain explicit; never pick Monday 3 versus weekday 4 without consent. Record latency as diagnostic replay latency, not end-to-end user latency.

## Results

- Latest develop already contains the complete Japanese namespace (PR 115/116, web 1.3.14). Preserve it; this patch adds missing concrete staffing-conflict rendering and settings navigation.
- Identified historical request was evaluated in memory on the current dev engine, via a read-only transaction and direct preflight/solver/diagnosis calls. No apply/approve HTTP calls, model calls, roster writes, saved-condition changes or trace writes.
- Original: INFEASIBLE, 8.903 seconds including recovery search. Proven N12 lower bound 4 / upper bound 3 on November 2, 9, 16, 23, 30. No independently verified proposal, zero applied cells.
- Hypothetical Monday 3 / Tuesday–Friday 4, preserving all other conditions: INFEASIBLE in 2.81 seconds. This does not identify the additional cause and is not a verified repair recommendation. Do not present resolving the overlap as sufficient for success.
- These are engine diagnostic timings, not browser end-to-end latency or user success rates.
- Spring preserves structured engine violations via AiEngineResultDto. UI previously discarded them and chose a generic infeasible message. This patch renders only structurally valid proven staffing contradictions, groups repeated dates, and exposes request editing and existing condition-settings navigation. No apply button without a verified proposal. Unknown failures retain existing handling.
- Japanese wrapping uses normal Japanese line breaks. Local browser QA checked a narrow 390px component and both callbacks; it did not impersonate the user or submit changes.
- Baseline validation: 2,447 web tests passed, 3 skipped; type check and production build passed. Focused tests cover Japanese key/placeholder parity, failure explanation, action callbacks, expired/duplicate proposal handling. Final focused checks follow the display grouping/wrapping change.
- Existing Japanese release: main 87406d3b6621202fb0ec053cc9943c81c9636ad0, Cloudflare Pages dutying-web-ai e8024727-8c30-4233-a92f-cf0cc7ad7b85 succeeded. app.dutying.ai and referenced store-BcKtGUg5.js returned 200 with Japanese failure text. This is separate from the not-yet-released conflict explanation patch.
- Budget correction: live organization settings confirm an Actions budget of USD 100 with stop-usage enabled; October net usage was USD 15.15. The prior USD 15 blocker was incorrect. Proceed with necessary release checks under the current budget; do not change billing settings.
