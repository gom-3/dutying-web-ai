# Transient conversation message times

The deployed timestamp change covers persisted turns, operations and local transcript messages, but the initial AiConversationEntry greeting and rebuild prompt render directly through AssistantMessage. A fresh development browser reproduces a greeting with no time element despite the correct deployment bundle.

Add an opt-in time display to the shared message bubbles for transient prompts. Capture their display time once per mounted message, retaining it across rerenders; do not enable this fallback for stored history. Enable it for entry greetings, entry choices and the rebuild prompt. Preserve saved timestamps for server and local transcript events. Also display the existing saved time for local error feedback, which bypasses AiAutofillMessages.

No API/schema changes, data cleanup or CI configuration changes. Validate timestamp stability and the initial sidebar greeting, then merge only to develop.
