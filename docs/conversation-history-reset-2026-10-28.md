# AI conversation history reset and message times

The user requested removal of obsolete AI sidebar conversations in development and production, including today's earlier conversations. The cutoff is 2026-10-28 06:00:00 Asia/Seoul. This is a one-time operational data cleanup, with no schema migration.

Delete conversation-owned plans, operations, turns and conversations in one transaction. Check that no selected operation is in flight. Keep applied ward shifts, immutable result versions, preferences and incident telemetry. Verify remaining old conversations and protected row counts after cleanup.

Development cleanup removed 20 conversations, 76 turns, 23 operations and 28 plans. Production already had zero conversations. Protected ward_shift counts remained 84,270 / 24,072 respectively; result versions remained 82 / 0.

Browser preparation/transcript caches also contain obsolete messages independently of the API. Move the schedule-chat namespace to v2 and remove only v1 schedule-chat keys when reading. Other browser data remains intact.

Render semantic time elements for server events using createdAt, and persist creation times for local preparation and feedback messages. Spring LocalDateTime values have no offset and are stored in Asia/Seoul; parse those explicitly with +09:00 before formatting in the viewer's local time. Include date and minute precision so old records are unambiguous. Missing/invalid times remain absent instead of inventing historical times.

A separate read-only connection at 06:05 KST confirmed zero conversations and operations in both environments after commit. Local verification: 273 focused tests passed; TypeScript, targeted ESLint and release verification passed. Browser cache cleanup becomes effective when the updated web app loads; already-open old clients require reloading after deployment.
