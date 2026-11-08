import {defineEvents} from '@abto-app/event';

// Explicit development-only facts; never prompt, file or roster content.
export const abtoEvents = defineEvents({
    roster_import_requested: {description: 'Server-side onboarding file analysis requested'},
    roster_import_draft_ready: {description: 'Server analysis prepared an onboarding draft for review'},
    roster_import_failed: {description: 'Server analysis or onboarding draft preparation failed'},
    schedule_request_started: {description: 'E1: Scheduling HTTP request started'},
    schedule_http_response: {description: 'E2: Scheduling HTTP response received, not UI application'},
    schedule_request_failed: {description: 'E3: Scheduling HTTP failure or cancellation'},
    schedule_request_roundtrip: {description: 'E4: Scheduling HTTP round trip, not model execution time'},
    schedule_server_result: {description: 'E5: Server-reported terminal scheduling status'},
    schedule_candidate_ready: {description: 'A candidate available for review or application'},
    schedule_applied: {description: 'E6: Result actually applied to the editor'},
    schedule_undone: {description: 'E7: Applied result actually undone'},
});
