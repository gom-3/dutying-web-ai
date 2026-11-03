import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiConversationLoading} from './ai-conversation-loading';

export function isConversationOperationPending(operation: TConversationOperation) {
    return !conversationOperationFailure(operation) && ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
}

export function conversationOperationStatusKey(operation: TConversationOperation, attempt = 1) {
    return operation.executionStatus === 'CANCELLED'
        ? 'cancelled'
        : operation.progress?.phase === 'QUEUED'
          ? 'queued'
          : operation.progress?.phase === 'VALIDATING'
            ? 'verifying'
            : operation.executionStatus === 'UNKNOWN'
              ? 'checkingTheResult'
              : operation.executionStatus === 'RESULT_READY'
                ? 'finishingYourSchedule'
                : operation.operationType === 'ADJUST'
                  ? 'adjustingYourSchedule'
                  : attempt > 1
                    ? 'refillingYourSchedule'
                    : 'fillingYourSchedule';
}

/** Progress is transient UI state; only the result belongs in the conversation history. */
export function AiConversationOperationStatus({
    operation,
    attempt,
    children,
}: {
    operation: TConversationOperation;
    attempt: number;
    children?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const pending = isConversationOperationPending(operation);
    const calculating = operation.executionStatus === 'RUNNING';
    const longRunning = calculating && operation.progress?.phase === 'COMPUTING' && operation.progress.elapsedMs >= 30000;

    return (
        <div className="space-y-4">
            {pending && (
                <AiConversationLoading
                    label={t(`aiAutofillUi.conversationOperationStatus.${conversationOperationStatusKey(operation, attempt)}`)}
                    description={
                        longRunning
                            ? `${t('aiAutofillUi.conversationOperationStatus.continuing')} ${t('aiAutofillUi.conversationOperationStatus.backgroundHint')}`
                            : calculating
                              ? t('aiAutofillUi.conversationOperationStatus.requestedAndFixedShiftsStayInPlace')
                              : undefined
                    }
                    animated={operation.executionStatus !== 'UNKNOWN'}
                />
            )}
            {operation.executionStatus === 'CANCELLED' && (
                <p role="status" className="text-sm text-[#475467]">
                    {t('aiAutofillUi.conversationOperationStatus.cancelled')}
                </p>
            )}
            {children}
        </div>
    );
}
