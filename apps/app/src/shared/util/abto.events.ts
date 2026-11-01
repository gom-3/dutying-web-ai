import {defineEvents} from '@abto-app/event';

// E1–E7: explicit, development-only scheduling facts; never prompt/roster content.
export const abtoEvents = defineEvents({
    schedule_request_started: {description: 'E1: Scheduling HTTP request started'},
    schedule_http_response: {description: 'E2: Scheduling HTTP response received, not UI application'},
    schedule_request_failed: {description: 'E3: Scheduling HTTP failure or cancellation'},
    schedule_request_roundtrip: {description: 'E4: Scheduling HTTP round trip, not model execution time'},
    schedule_server_result: {description: 'E5: Server-reported terminal scheduling status'},
    schedule_applied: {description: 'E6: Result actually applied to the editor'},
    schedule_undone: {description: 'E7: Applied result actually undone'},
});
