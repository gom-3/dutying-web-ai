import * as Sentry from '@sentry/react';
import {beforeEach, expect, it, vi} from 'vitest';
import client from '@/shared/api/client';
import {AiConversationInputError} from '../ai-conversation-failure';
import {reportScheduleClientFailure} from '../schedule-client-failure';

vi.mock('@sentry/react', () => ({captureMessage: vi.fn()}));
vi.mock('@/shared/api/client', () => ({default: {post: vi.fn().mockResolvedValue({status: 200})}}));

const scope = {wardId: 1, teamId: 2, conversationId: 3};

beforeEach(() => vi.clearAllMocks());

it('records local guard failures without requiring an operation or forwarding request contents', async () => {
    await reportScheduleClientFailure(scope, 'GUARD', new AiConversationInputError('staleRequest'), 'attempt-1');
    expect(client.post).toHaveBeenCalledWith(
        '/wards/1/shift-teams/2/schedule/conversations/3/reports',
        {operationId: null, note: '[CLIENT_REQUEST_FAILURE] {"stage":"GUARD","reason":"staleRequest"}', idempotencyKey: 'attempt-1'},
        {suppressErrorToast: true, validateStatus: expect.any(Function), timeout: 5000},
    );

    const options = vi.mocked(client.post).mock.calls[0]![2]!;

    expect(options.validateStatus!(401)).toBe(true);
    expect(options.validateStatus!(503)).toBe(true);
});

it('keeps server failures distinct and strips arbitrary exception data', async () => {
    const error = {
        code: 503,
        serverCode: 'SCHEDULE_INTERPRET_UNAVAILABLE',
        message: 'PRIVATE NAME AND TEXT',
        originalError: {token: 'SECRET'},
    };

    await reportScheduleClientFailure(scope, 'INTERPRET', error, 'attempt-2');
    expect(client.post).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith('schedule_client_request_failed', {
        level: 'warning',
        tags: {stage: 'INTERPRET', reason: 'SCHEDULE_INTERPRET_UNAVAILABLE', httpStatus: 503},
    });
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toMatch(/PRIVATE|SECRET/);
});

it('does not let either diagnostic destination replace the original failure', async () => {
    vi.mocked(Sentry.captureMessage).mockImplementationOnce(() => {
        throw new Error('unavailable');
    });
    vi.mocked(client.post).mockRejectedValueOnce(new Error('unavailable'));
    await expect(reportScheduleClientFailure(scope, 'SYNC', {serverCode: 'PRIVATE body', code: -1}, 'attempt-3')).resolves.toBeUndefined();
    expect(JSON.stringify(vi.mocked(client.post).mock.calls)).not.toContain('PRIVATE');
});
