import {beforeEach, expect, it, vi} from 'vitest';
import client from '@/shared/api/client';
import {captureScheduleEvent} from '@/shared/util/abto';
import {conversationApi, type TConversationOperation} from '../schedule-conversation-api';
import {observeConversationResult, observeScheduleApplication, observeScheduleRequest} from '../schedule-telemetry';

vi.mock('@/shared/api/client', () => ({default: {get: vi.fn(), post: vi.fn(), delete: vi.fn()}}));
vi.mock('@/shared/util/abto', () => ({captureScheduleEvent: vi.fn()}));
beforeEach(() => vi.clearAllMocks());

it('records HTTP completion and timing without sending request or response contents', async () => {
    const sensitive = {text: 'PRIVATE REQUEST', nurseId: 123, wardId: 456};
    expect(await observeScheduleRequest('INTERPRET', async () => sensitive)).toBe(sensitive);
    expect(vi.mocked(captureScheduleEvent).mock.calls.map(([name]) => name)).toEqual([
        'schedule_request_started',
        'schedule_http_response',
        'schedule_request_roundtrip',
    ]);
    expect(JSON.stringify(vi.mocked(captureScheduleEvent).mock.calls)).not.toContain('PRIVATE');
    expect(captureScheduleEvent).toHaveBeenLastCalledWith('schedule_request_roundtrip', 'INTERPRET', undefined, expect.any(Number));
});

it.each([{code: 'ERR_CANCELED'}, new Error('PRIVATE FAILURE')])(
    'preserves request rejection while recording safe failure status',
    async (error) => {
        await expect(
            observeScheduleRequest('ADJUST', async () => {
                throw error;
            }),
        ).rejects.toBe(error);
        expect(captureScheduleEvent).toHaveBeenCalledWith('schedule_request_failed', 'ADJUST', 'code' in error ? 'CANCELLED' : 'FAILED');
        expect(captureScheduleEvent).not.toHaveBeenCalledWith('schedule_http_response', expect.anything());
        expect(JSON.stringify(vi.mocked(captureScheduleEvent).mock.calls)).not.toContain('PRIVATE');
    },
);

it('does not confuse asynchronous acknowledgements with completion or UI application; deduplicates polling', () => {
    const pending = {operationId: 'private-operation-1', operationType: 'GENERATE', executionStatus: 'RUNNING'} as TConversationOperation;
    expect(observeConversationResult(pending)).toBe(pending);
    observeConversationResult({...pending, executionStatus: 'RESULT_READY'});
    expect(captureScheduleEvent).not.toHaveBeenCalled();
    const complete = {...pending, executionStatus: 'SUCCEEDED', result: {engineResult: {status: 'ACCEPTED'}}} as TConversationOperation;
    observeConversationResult(complete);
    observeConversationResult(complete);
    expect(captureScheduleEvent).toHaveBeenCalledExactlyOnceWith('schedule_server_result', 'GENERATE', 'COMPLETED');
    expect(JSON.stringify(vi.mocked(captureScheduleEvent).mock.calls)).not.toContain('private-operation');
});

it('separates blocked, failed and cancelled server outcomes from UI actions', () => {
    const result = {
        operationId: 'private-operation-2',
        operationType: 'ADJUST',
        executionStatus: 'SUCCEEDED',
        result: {engineResult: {status: 'INFEASIBLE'}},
    } as TConversationOperation;
    observeConversationResult(result);
    observeConversationResult({...result, executionStatus: 'FAILED'});
    observeConversationResult({...result, executionStatus: 'CANCELLED'});
    expect(vi.mocked(captureScheduleEvent).mock.calls.map(([, , outcome]) => outcome)).toEqual(['BLOCKED', 'FAILED', 'CANCELLED']);
});

it('records actual apply and undo once despite server receipt retries, without internal keys', () => {
    observeScheduleApplication('private-server-event-apply', 'CLIENT_APPLIED');
    observeScheduleApplication('private-server-event-apply', 'CLIENT_APPLIED');
    observeScheduleApplication('private-server-event-undo', 'CLIENT_UNDONE');
    expect(vi.mocked(captureScheduleEvent).mock.calls).toEqual([
        ['schedule_applied', 'UNKNOWN'],
        ['schedule_undone', 'UNKNOWN'],
    ]);
});

it('recognizes transformed cancellations and HTTP errors without error bodies', async () => {
    await expect(
        observeScheduleRequest('ADJUST', () => Promise.reject({code: -1, originalError: {code: 'ERR_CANCELED'}})),
    ).rejects.toBeTruthy();
    expect(captureScheduleEvent).toHaveBeenCalledWith('schedule_request_failed', 'ADJUST', 'CANCELLED');
    vi.clearAllMocks();
    await expect(observeScheduleRequest('ADJUST', () => Promise.reject({code: 503, message: 'PRIVATE'}))).rejects.toBeTruthy();
    expect(captureScheduleEvent).toHaveBeenCalledWith('schedule_http_response', 'ADJUST', 'FAILED');
    expect(captureScheduleEvent).not.toHaveBeenCalledWith('schedule_request_failed', expect.anything(), expect.anything());
});

it('wires conversation execute/poll/cancel without changing async headers or counting polls as requests', async () => {
    const pending = {operationId: 'private-wired-operation', operationType: 'ADJUST', executionStatus: 'RUNNING'} as TConversationOperation;
    vi.mocked(client.post).mockResolvedValue({data: pending});
    vi.mocked(client.get).mockResolvedValue({data: pending});
    vi.mocked(client.delete).mockResolvedValue({data: {...pending, executionStatus: 'CANCELLED'}});
    const request = {expectedRevision: 1, idempotencyKey: 'private-key', operationType: 'ADJUST' as const};
    const api = conversationApi(123, 456);
    expect(await api.execute(789, request)).toBe(pending);
    await api.operation(pending.operationId);
    await api.cancelOperation(pending.operationId);
    expect(client.post).toHaveBeenCalledWith('/wards/123/shift-teams/456/schedule/conversations/789/operations', request, {
        suppressErrorToast: true,
        timeout: 330000,
        headers: {Prefer: 'respond-async'},
    });
    expect(vi.mocked(captureScheduleEvent).mock.calls.filter(([name]) => name === 'schedule_request_started')).toHaveLength(1);
    expect(captureScheduleEvent).toHaveBeenCalledWith('schedule_server_result', 'ADJUST', 'CANCELLED');
    expect(JSON.stringify(vi.mocked(captureScheduleEvent).mock.calls)).not.toContain('private');
});

it('counts a reviewable adjustment candidate once and keeps application separate', () => {
    const result = {
        operationId: 'private-candidate-operation',
        operationType: 'ADJUST',
        executionStatus: 'SUCCEEDED',
        result: {
            observation: {serverEventId: 'private-candidate-receipt'},
            authoringOutcome: {draftState: 'PREVIEW_ONLY', candidateDigest: 'private-digest'},
        },
    } as TConversationOperation;
    observeConversationResult(result);
    observeConversationResult(result);
    expect(captureScheduleEvent).toHaveBeenCalledWith('schedule_candidate_ready', 'ADJUST');
    expect(vi.mocked(captureScheduleEvent).mock.calls.filter(([name]) => name === 'schedule_candidate_ready')).toHaveLength(1);
    expect(captureScheduleEvent).not.toHaveBeenCalledWith('schedule_applied', expect.anything());
    observeScheduleApplication('private-candidate-apply', 'CLIENT_APPLIED', 'ADJUST');
    expect(captureScheduleEvent).toHaveBeenLastCalledWith('schedule_applied', 'ADJUST');
    expect(JSON.stringify(vi.mocked(captureScheduleEvent).mock.calls)).not.toContain('private');
});

it('does not count a completed adjustment without a candidate', () => {
    observeConversationResult({
        operationId: 'no-candidate-operation',
        operationType: 'ADJUST',
        executionStatus: 'SUCCEEDED',
        result: {authoringOutcome: {draftState: 'NONE'}, engineResult: {status: 'ACCEPTED'}},
    } as TConversationOperation);
    expect(captureScheduleEvent).toHaveBeenCalledExactlyOnceWith('schedule_server_result', 'ADJUST', 'COMPLETED');
});
