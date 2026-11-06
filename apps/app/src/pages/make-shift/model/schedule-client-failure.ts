import * as Sentry from '@sentry/react';
import client from '@/shared/api/client';
import {AiConversationInputError} from './ai-conversation-failure';

export type TRequestStage = 'SYNC' | 'GUARD' | 'INTERPRET' | 'REFRESH';

/** Caught pre-execution failures have no operation receipt. Never forward the original error or request. */
export async function reportScheduleClientFailure(
    scope: {wardId: number; teamId: number; conversationId: number},
    stage: TRequestStage,
    error: unknown,
    attemptId: string,
): Promise<void> {
    const source = error as {serverCode?: unknown; code?: unknown} | null;
    const reason =
        error instanceof AiConversationInputError
            ? error.reason
            : typeof source?.serverCode === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(source.serverCode)
              ? source.serverCode
              : 'UNKNOWN';
    const httpStatus = typeof source?.code === 'number' && source.code >= 100 && source.code <= 599 ? source.code : undefined;
    const diagnostic = {stage, reason, ...(httpStatus ? {httpStatus} : {})};

    try {
        Sentry.captureMessage('schedule_client_request_failed', {level: 'warning', tags: diagnostic});
    } catch {
        // Optional observation never changes editing or recovery.
    }

    // Interpretation failures already have a server incident. Only report the missing pre-request path.
    if (stage !== 'SYNC' && stage !== 'GUARD') return;

    try {
        await client.post(
            `/wards/${scope.wardId}/shift-teams/${scope.teamId}/schedule/conversations/${scope.conversationId}/reports`,
            {operationId: null, note: `[CLIENT_REQUEST_FAILURE] ${JSON.stringify(diagnostic)}`, idempotencyKey: attemptId},
            {suppressErrorToast: true, validateStatus: () => true, timeout: 5000},
        );
    } catch {
        // A failed diagnostic delivery must not replace the original failure or retry the request.
    }
}
