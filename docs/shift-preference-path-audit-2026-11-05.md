# Shift-preference failure path audit — 2026-11-05

## Evidence and boundaries

The reported UI is the legacy review (RULE → lifetime → severity), and incident
entry is DIRECT. Its raw model response and exception origin remain unavailable:
production SSH authentication expired. Do not label a prompt guess as the verified
cause of this specific incident.

Source-confirmed failure paths:
1. `index.tsx` mounts the negotiated sidebar only when conversationEnabled is true.
   Prior changes enabled semantic/intent flags but left the common conversation
   default false. That does not move DIRECT users onto the corrected path.
2. Legacy interpret_adjust_sentence calls adjust_interpreter._SYSTEM_PROMPT, not
   intent_extractor.SYSTEM_PROMPT. A correction in the latter alone cannot fix the
   old path's missing reference. Share whole-message reference guidance across both.
3. Legacy review offered HARD for NURSE_PREFER_SHIFT. Catalog.resolveSeverity rejects
   unsupported HARD with IllegalArgumentException, which the exception handler maps
   to INVALID_PARAMETER/400. This matches the observed sequence but the actual
   exception origin is not yet verified. Prior review change removes the promotion.
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
