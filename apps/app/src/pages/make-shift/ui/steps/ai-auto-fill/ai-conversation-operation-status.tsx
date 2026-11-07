import {CircleHelp, CircleStop} from 'lucide-react';
import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AssistantMessage} from './ai-adjust-review-conversation';
import {AiConversationLoading} from './ai-conversation-loading';
import {AiConversationTimestamp} from './ai-conversation-timestamp';

export function isConversationOperationPending(operation: TConversationOperation) {
    return !conversationOperationFailure(operation) && ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
}

export function conversationOperationStatusKey(operation: TConversationOperation, attempt = 1) {
    if (operation.executionStatus === 'CANCELLED') return 'cancelled';

    if (operation.executionStatus === 'UNKNOWN') return 'resultNotConfirmed';

    if (operation.executionStatus === 'RESULT_READY') return 'finishingYourSchedule';

    if (operation.progress?.phase === 'QUEUED') return 'queued';

    if (operation.progress?.phase === 'VALIDATING') return 'verifying';

    if (operation.operationType === 'ADJUST') return 'adjustingYourSchedule';

    return attempt > 1 ? 'refillingYourSchedule' : 'fillingYourSchedule';
}

/** Progress is transient UI state; only the result belongs in the conversation history. */
export function AiConversationOperationStatus({
    operation,
    attempt,
    action,
    pendingAction,
    children,
}: {
    operation: TConversationOperation;
    attempt: number;
    action?: ReactNode;
    pendingAction?: 'recheck' | 'cancel';
    children?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const pending = isConversationOperationPending(operation);
    const cancelling = operation.executionStatus === 'RUNNING' && pendingAction === 'cancel';
    const phase = operation.progress?.phase;
    const calculating = !cancelling && operation.executionStatus === 'RUNNING' && (!phase || phase === 'COMPUTING');
    const resultUnconfirmed = operation.executionStatus === 'UNKNOWN';
    const rechecking = resultUnconfirmed && pendingAction === 'recheck';
    const longRunning = calculating && (operation.progress?.elapsedMs ?? 0) >= 30_000;
    const statusKey = cancelling ? 'cancelling' : longRunning ? 'continuing' : conversationOperationStatusKey(operation, attempt);
    const label = rechecking ? t('aiConversationSidebar.checkingResult') : t(`aiAutofillUi.conversationOperationStatus.${statusKey}`);
    const needsRecheck = resultUnconfirmed && !rechecking;
    const description = needsRecheck
        ? t('aiConversationSidebar.recheckOutcomeHint')
        : longRunning
          ? t('aiAutofillUi.conversationOperationStatus.backgroundHint')
          : calculating
            ? t('aiAutofillUi.conversationOperationStatus.requestedAndFixedShiftsStayInPlace')
            : undefined;

    return (
        <div className="space-y-4">
            {pending && (
                <AssistantMessage fullWidth={Boolean(action)}>
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                        <AiConversationLoading
                            className={action ? 'min-w-0 flex-[1_1_10rem] py-0!' : 'py-0!'}
                            label={label}
                            description={description}
                            indicator={needsRecheck ? <CircleHelp className="size-4 text-[#946318]" /> : undefined}
                        />
                        {action}
                    </div>
                </AssistantMessage>
            )}
            {operation.executionStatus === 'CANCELLED' && (
                <AiConversationTimestamp createdAt={operation.createdAt}>
                    <AssistantMessage>
                        <AiConversationLoading
                            className="py-0!"
                            label={t('aiAutofillUi.conversationOperationStatus.cancelled')}
                            indicator={<CircleStop className="size-4 text-[#667085]" />}
                        />
                    </AssistantMessage>
                </AiConversationTimestamp>
            )}
            {children}
        </div>
    );
}
