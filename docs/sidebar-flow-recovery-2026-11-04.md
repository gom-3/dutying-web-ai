# Sidebar completion and conflict recovery

Reported journey: a completed roster has no exit action; conflict actions survive choosing request editing; condition editor's discard action leaks into the chat; a corrected nurse name loses the preceding request; shift eligibility is interpreted as a minimum monthly assignment.

## Decisions

- The latest applied result owns one “근무표 확인하고 돌아가기” action, which closes the conversation and focuses the existing editor. Historical results never own current actions. Typing a follow-up hides the result action.
- A failed generation does not automatically open another fixed-shift preparation. Recovery starts only when its button is selected.
- Editing a failed request dismisses its recovery actions immediately. Conflict evidence remains readable, but historical or dismissed cards expose no live actions. Settings editing does not calculate or accept exceptions; cancel returns to recovery and applying invalidates old candidates.
- The condition discard dialog is mounted only while explicitly open, preventing the secondary “계속 수정하기” action from surviving a completed close.
- Nurse titles and attached Korean particles are accepted for exact names. Misspellings receive roster-based suggestions for confirmation, never automatic reassignment. A corrected-name answer retains the original scheduling request.
- “E 근무 가능하게” expresses eligibility, not a quota. Ask whether the user wants to change member settings or request an actual assignment; never invent “월 1회 이상”.

No database schema changes. Verify completion, follow-up, request editing, stale conflict cards, settings cancellation, name matching and eligibility with local regression checks. No production deployment is included.

## Verification

- Web: 232 tests across sidebar, conflict consent, conditions editor and entry; TypeScript build, production bundle and focused ESLint pass.
- LLM: 257 offline tests across name references, clarification, interpretation, semantic resolution and conversation state; Ruff lint/format pass. No live LLM calls were made, so free-form model accuracy beyond these fixtures remains unmeasured.
- Flyway migration 없음. No database access or production deployment.
- Integration: only these changes go to each repository's `origin/develop`; Actions triggers were inspected (PR/manual validation, main production release). No validation workflow is manually triggered.
