# Catalog plan review contract

The semantic backend now supports CATALOG_RULE in addition to concrete cell/count actions. The current card treats every unrecognized action as COUNT and displays an empty quota; that makes confirmation misleading.

Keep the layout and interaction unchanged. Extend the wire type with CATALOG_RULE, MAX_CONSECUTIVE_WORK, rule (templateCode/params), and optional displayText. CATALOG_RULE uses the deterministic server-rendered text from the confirmed catalog parameters, never the generic envelope's all-nurses/all-shifts values as the rule subject. Block applying a catalog plan if that description is absent. Keep its required/preferred marker visible. Display consecutive-work limits as a run limit, and soft assignments as preferences.

The backend computes displayText on response copies only; the hash-bound stored payload remains unchanged. Deploy the compatible web and Spring consumers before enabling the new LLM producer. No visual redesign, no API invocation or production deployment in this change.
