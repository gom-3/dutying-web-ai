# Shift-preference failure path audit — 2026-11-05

## Evidence and boundaries

The reported UI is the legacy review (RULE → lifetime → severity), and incident
entry is DIRECT. AWS authentication was renewed using the existing Dutying browser session and
`aws login --profile dutying-target`. Bounded production logs confirm:
- 11:06:00 KST: the original text entered /schedule/adjust/interpret (legacy).
- 11:06:08: items=1, unmapped=1, prompt adjust-interpret-2026-10-29-v27-rebuild.
- 11:07:03: /schedule/autofill rejected in ScheduleMonthRuleCatalog.resolveSeverity:387,
  with "이 조건은 '꼭'으로 실행할 수 없어요. '권장' 조건인지 확인해 주세요."
  GlobalExceptionHandler mapped it to INVALID_PARAMETER/HTTP 400.
The model returned a partial interpretation; the later execution failure occurred
in Spring severity validation, before the solver. A read-only SELECT of this single trace subsequently confirmed the model output:
one NURSE_PREFER_SHIFT rule with the correct nurse/shift and SOFT severity, plus
NURSE_NOT_RESOLVED for the immediately following pronoun sentence. Normalization
preserved both; it did not introduce the unresolved item. No roster input, credentials,
or raw output is stored in this document.

Trace 9b2520cd-7d23-4dc3-a604-ea542a0e5adf used provider gemini, model
gemini-3.8-flash, status PARTIAL. The earlier paid Sonnet evaluation ran on development
configuration and is not evidence for this production model/prompt path. The new
shared reference prompt has passed local contract checks, not a new live-model
accuracy evaluation. No model replacement was made.

Source-confirmed failure paths:
1. `index.tsx` mounts the negotiated sidebar only when conversationEnabled is true.
   Prior changes enabled semantic/intent flags but left the common conversation
   default false. That does not move DIRECT users onto the corrected path.
2. Legacy interpret_adjust_sentence calls adjust_interpreter._SYSTEM_PROMPT, not
   intent_extractor.SYSTEM_PROMPT. A correction in the latter alone cannot fix the
   old path's missing reference. Share whole-message reference guidance across both.
3. Legacy review offered HARD for NURSE_PREFER_SHIFT. Catalog.resolveSeverity rejects
   unsupported HARD with IllegalArgumentException, which the exception handler maps
   to INVALID_PARAMETER/400. The production exception origin now confirms this rejection path. Prior review change removes the promotion.
4. The card's formatValue handles nurseId/nurseIds/target but not the catalog's
   singular nurse key, exposing a raw ID even though the name exists in the roster.

## Changes

Enable the conversation environment default together with the already-enabled
semantic/intent contracts. Explicit environment and per-ward/global admin overrides
remain authoritative. No Redis settings or production services are changed.
Share context/reference guidance across legacy and negotiated interpretation;
no regex chooses a pronoun's identity and no unresolved output is silently dropped.
Render catalog person slots as roster names; unknown IDs use the existing unavailable
label rather than leaking internal IDs. Verify only affected flow/format contracts.

No database migration; deployment still needs Python then Spring/frontend with
runtime capability checks. Source defaults alone do not prove production activation.
