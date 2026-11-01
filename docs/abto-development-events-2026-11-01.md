# ABTO development events

The approved repository map is React (`dutying-web`) → Spring
(`dutying-server-ai`) → FastAPI (`dutying-llm-server`). Keep all model execution
on BizRouter and its existing Sonnet configuration. Only the web Event SDK is
needed for this event-only integration; do not install Calling SDKs or add a
request-ID bridge to the servers.

Use the existing pnpm workspace and `@abto-app/event` 1.2.1. Initialize once from
`initializeApp`, gated by an explicit Vite flag, a public Event Key and an existing
non-production hostname check. Production domains stay disabled even if the flag
is accidentally enabled. Initialization emits no events; verify this with the
public SDK before adding selected event calls.

Custom event names and exact product triggers require selection before capture
calls are added. No automatic DOM/page collection, account identification, nurse
identifiers, roster contents, free text, model tokens or estimated billing.
Browser-observed request timing must not be described as provider execution time
or total background job duration.

Official documentation checked on 2026-11-01:

- https://docs.abto.app/sdk/javascript/browser/
- https://docs.abto.app/events/
- https://docs.abto.app/sdk/python/

The public Python Calling SDK 1.2.2 was inspected without installation; its normal
Gateway provider keys do not establish a BizRouter execution path. It is excluded
by the user's event-only choice. The pre-existing BizRouter endpoint and fallback
behavior are unchanged.

## Selected events and exact triggers

The user selected all E1–E7 and authorized a bounded synthetic ingestion check.

| ID | Event | Trigger |
| --- | --- | --- |
| E1 | `schedule_request_started` | Legacy generate/adjust POST and legacy interpret, conversation interpret/execute, before the HTTP request |
| E2 | `schedule_http_response` | Resolved HTTP request, or a transformed HTTP error with a status code; never UI application |
| E3 | `schedule_request_failed` | Transport rejection/cancellation, including the existing client's wrapped cancellation |
| E4 | `schedule_request_roundtrip` | Request finally block; milliseconds measured by the browser |
| E5 | `schedule_server_result` | Legacy server engine status; conversation terminal operation response from execute/poll/cancel |
| E6 | `schedule_applied` | Existing `reportScheduleJourney` CLIENT_APPLIED fact after editor application |
| E7 | `schedule_undone` | Existing `reportScheduleJourney` CLIENT_UNDONE fact after editor undo |

`RUNNING` and `RESULT_READY` are not counted as terminal completion. Polls are not
new requests for E1–E4. Conversation terminal states are deduplicated in memory;
server event receipt retries do not repeat E6/E7. Deduplication is bounded to 500
entries, and is not an exactly-once guarantee across reloads. E6/E7 require the
existing server observation receipt; without it the state remains unobserved.
The request text, HTTP paths, errors, result object and internal deduplication
keys are never sent. Apply/undo use operation UNKNOWN because the existing fact
has no trustworthy operation type. COMPLETED is a declared server engine result,
not proof of rule quality, approval or application. Unknown engine statuses stay
UNKNOWN. No mock-provider requests are counted.

## Change ledger

- Core: app dependency/lockfile, initialization, Vite types, dev-only ABTO client,
  and initialization/disabled-domain/privacy serialization tests.
- Events E1–E7: explicit registry; controlled event metadata; scheduling telemetry
  module; legacy request, conversation API and existing journey fact call sites;
  request/poll/cancel/apply/undo/privacy regression tests.
- Design: this document. No Spring/FastAPI behavior, database schema, model,
  BizRouter credential, provider timeout or model retry policy changes.

## Verification and current limits

On 2026-11-01 the public Browser SDK 1.2.1 sent seven explicitly labelled
`synthetic_test=dutying-dev-20261101` events using the project's public Event Key.
The collector returned HTTP 202 and per-event `result=ok` for all seven. This
check used the released SDK, not a fabricated event envelope or a paid model call.
The ABTO project is **Dutying Development**, request/response body storage OFF.

ABTO's current `/events`, `/overview` and `/settings/features` screens still say
there are no features and direct the user to Calling integration. Therefore
collector acceptance is verified, but dashboard visibility/metric setup is NOT
verified. No Gateway call, artificial request ID, guessed feature adapter or
private dashboard API is used to bypass that limitation.

The development Pages project is `dutying-web-ai-dev` (`dev.dutying.ai`); its
Cloudflare environment is named Production but is separate from the real
production project. The public Event Key and explicit enabled flag were saved
only in this dev project. Automatic deployments remain paused. Runtime production
domain gating remains active. Deployment evidence is recorded after deployment.

## Calling inventory disposition

The reviewed development LLM source (ee54a924) contains these provider surfaces
in `src/services/llm_provider.py`; all remain **user-excluded** from ABTO Calling
under the explicitly selected BizRouter-preserving event-only scope:

| Candidate | Provider/API | Disposition |
| --- | --- | --- |
| L1 | OpenAI chat completions (line 243) | user-excluded |
| L2 | BizRouter OpenAI-compatible chat (line 327) | user-excluded; active scheduling provider retained |
| L3/L4 | Gemini generate_content (lines 501, 626) | user-excluded |
| L5 | Qwen OpenAI-compatible multimodal chat (line 741) | user-excluded |
| L6 | Anthropic messages (line 844) | user-excluded |

Shared callers include `LLMService`, semantic intent extraction and Excel parsing.
Excel parsing is outside the selected scheduling event triggers. No Calling
feature/node IDs, server SDK run IDs or Gateway request IDs were introduced.
No ABTO model/token/cost attribution is claimed for any direct provider path.

Local checks: frozen-lockfile installation succeeded. Eight targeted Vitest files
passed (164 tests), including SDK initialization/privacy, request/transport,
async execute/poll/cancel, journey receipt retries and the adjustment UI suite.
`tsc --noEmit`, app build and `git diff --check` passed. Existing React act and
Vite chunk warnings remain. No GitHub Actions validation was triggered to repeat
these checks. Cloudflare's production, docs and landing project histories were
inspected separately: recent `[skip ci]` develop/feature revisions were skipped
without builds; the dev project's automatic deployments remain disabled.
