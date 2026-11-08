import type {TAutofillResponse} from '@dutying/api/ward';
import {captureScheduleEvent} from '@/shared/util/abto';
import type {TConversationOperation} from './schedule-conversation-api';

type Operation = 'GENERATE' | 'ADJUST' | 'INTERPRET';

/** E1–E4: one HTTP attempt. Poll requests deliberately do not use this function. */
export async function observeScheduleRequest<T>(operation: Operation, request: () => Promise<T>): Promise<T> {
    const started = performance.now();
    captureScheduleEvent('schedule_request_started', operation);
    try {
        const response = await request();
        captureScheduleEvent('schedule_http_response', operation);
        return response;
    } catch (error) {
        const failure = error as {code?: string | number; name?: string; originalError?: {code?: string; response?: unknown}};
        const cancelled =
            failure?.code === 'ERR_CANCELED' || failure?.name === 'AbortError' || failure?.originalError?.code === 'ERR_CANCELED';
        const httpResponse = typeof failure?.code === 'number' && failure.code >= 100 && failure.code <= 599;
        captureScheduleEvent(
            httpResponse ? 'schedule_http_response' : 'schedule_request_failed',
            operation,
            cancelled ? 'CANCELLED' : 'FAILED',
        );
        throw error;
    } finally {
        captureScheduleEvent('schedule_request_roundtrip', operation, undefined, performance.now() - started);
    }
}

const reported = new Set<string>();
function once(key: string, report: () => void) {
    if (reported.has(key)) return;
    reported.add(key);
    if (reported.size > 500) reported.delete(reported.values().next().value!);
    report();
}

/** E5: only declared engine statuses, never infer success from changed-cell count. */
export function observeScheduleResult(operation: Operation, result: TAutofillResponse) {
    const draftState = result.authoringOutcome?.draftState;
    const hasCandidate =
        draftState === 'APPLICABLE' ||
        draftState === 'PREVIEW_ONLY' ||
        draftState === 'CONSENT_REQUIRED' ||
        (!draftState && Boolean(result.goalCandidate));

    if (hasCandidate) {
        const id = result.observation?.serverEventId;
        if (id) once(`candidate:${id}`, () => captureScheduleEvent('schedule_candidate_ready', operation));
        else captureScheduleEvent('schedule_candidate_ready', operation);
    }

    const status = result.engineResult?.status;
    const outcome =
        status === 'ACCEPTED' || status === 'REPAIRED'
            ? 'COMPLETED'
            : status === 'REJECTED' || status === 'INFEASIBLE' || status === 'CONFLICT_REVIEW'
              ? 'BLOCKED'
              : status === 'TIME_LIMIT' || status === 'ERROR'
                ? 'FAILED'
                : 'UNKNOWN';
    captureScheduleEvent('schedule_server_result', operation, outcome);
}

/** E5: deduplicate polling by internal IDs. IDs are never included in ABTO payloads. */
export function observeConversationResult(result: TConversationOperation) {
    if (result.executionStatus === 'RUNNING' || result.executionStatus === 'RESULT_READY') return result;
    once(`operation:${result.operationId}:${result.executionStatus}`, () => {
        if (result.executionStatus === 'SUCCEEDED' && result.result) observeScheduleResult(result.operationType, result.result);
        else
            captureScheduleEvent(
                'schedule_server_result',
                result.operationType,
                result.executionStatus === 'FAILED' ? 'FAILED' : result.executionStatus === 'CANCELLED' ? 'CANCELLED' : 'UNKNOWN',
            );
    });
    return result;
}

/** E6/E7: called only after an actual editor action, independently of receipt retries. */
export function observeScheduleApplication(
    key: string,
    type: 'CLIENT_APPLIED' | 'CLIENT_UNDONE',
    operation: 'GENERATE' | 'ADJUST' | 'UNKNOWN' = 'UNKNOWN',
) {
    once(`application:${key}`, () => captureScheduleEvent(type === 'CLIENT_APPLIED' ? 'schedule_applied' : 'schedule_undone', operation));
}
