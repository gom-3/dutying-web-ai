import type {TConversationExecute, TConversationOperation} from './schedule-conversation-api';

type TPendingExecution = {
    conversationId: number;
    request: TConversationExecute;
    uiRevision: number;
    operationId?: string;
};

export const isExecutionFinished = (operation: Pick<TConversationOperation, 'executionStatus'>) =>
    operation.executionStatus === 'SUCCEEDED' || operation.executionStatus === 'FAILED';

/** Only a matching operation receipt may release a pending request; polling another result cannot. */
export function readPendingExecution(storage: Storage, key: string): TPendingExecution | null {
    return JSON.parse(storage.getItem(key) ?? 'null') as TPendingExecution | null;
}
