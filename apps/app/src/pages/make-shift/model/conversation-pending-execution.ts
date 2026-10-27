import type {TConversationExecute, TConversationOperation} from './schedule-conversation-api';

type TPendingExecution = {
    conversationId: number;
    request: TConversationExecute;
    uiRevision: number;
    operationId?: string;
    operationIdsBeforeRequest?: string[];
};

export const isExecutionFinished = (operation: Pick<TConversationOperation, 'executionStatus'>) =>
    operation.executionStatus === 'SUCCEEDED' || operation.executionStatus === 'FAILED';

/** Only a matching operation receipt may release a pending request; polling another result cannot. */
export function readPendingExecution(storage: Storage, key: string): TPendingExecution | null {
    return JSON.parse(storage.getItem(key) ?? 'null') as TPendingExecution | null;
}

/** These server replies reject the current input before accepting an operation.
 * Key conflicts and unknown 409s must remain recoverable instead of being discarded. */
export function isDefinitiveExecutionConflict(error: unknown): boolean {
    const response = error as {code?: number; serverCode?: string};

    return (
        response?.code === 409 &&
        [
            'SCHEDULE_REVISION_CONFLICT',
            'SCHEDULE_STALE_DRAFT_REVISION',
            'SCHEDULE_ADJUST_CONTEXT_CHANGED',
            'SCHEDULE_ROSTER_CHANGED',
            'CANDIDATE_STALE',
            'PLAN_EXPIRED',
        ].includes(response.serverCode ?? '')
    );
}
