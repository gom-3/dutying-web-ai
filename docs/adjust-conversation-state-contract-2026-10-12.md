# Server-owned scheduling conversation state

Companion design: `gom-3/dutying-server-ai/docs/designs/adjust-improvement-2026-10-12/03-conversation-state.md`.

The sidebar opts into the new protocol only when conversation detail includes `conversationState`. Missing/null capability preserves the existing legacy request concatenation and REPLACE API. The new server gate defaults OFF.

State-capable requests send the new utterance alone plus `expectedStateVersion`, schedule `expectedRevision`, edit mode, and explicit `targetConditionIds`. Default mode answers the server's single pending question; adding a separate condition while a question is pending is a distinct choice. UPDATE/REMOVE operate on checked condition IDs. RESET is explicit. Editing a ready plan opens condition selection instead of replacing every stored condition. Current condition text remains visible; checkboxes select conditions for editing, not a partial execution plan.

A condition is a server-generated UUID for one utterance and may contain several normalized intents. IDs remain stable across UPDATE and are removed only by explicit REMOVE/RESET. The 02 selection feature must use this grouping or define finer intent selection separately.

The backend reserves a state version before model work. On failure the sidebar retains typed input and refreshes detail so retry uses the new version. It also rejects a state version changed during preparation/sync. Owner/team/month, expiry, source-version checks and execution authority remain server-side.

Deployment order: FastAPI `/conversation-preview` → Spring (V64 additive migration; `DUTYING_SCHEDULE_CONVERSATION_STATE_ENABLED=false`) → web → explicitly enable state gate. Gate OFF restores legacy behavior. Existing confirm/execute APIs continue to use stored planHash/sourceVersion and never trust condition selection as execution authorization.
