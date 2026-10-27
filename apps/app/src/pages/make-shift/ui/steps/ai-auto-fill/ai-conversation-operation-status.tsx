import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {conversationOperationFailure} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';

export function isConversationOperationPending(operation: TConversationOperation) {
    return !conversationOperationFailure(operation) && ['RUNNING', 'RESULT_READY', 'UNKNOWN'].includes(operation.executionStatus);
}

export function AiConversationOperationStatus({
    operation,
    attempt,
}: {
    operation: TConversationOperation;
    attempt: number;
    copy: (ko: string, en: string) => string;
}) {
    const {t} = useTypedTranslation();
    const title =
        operation.executionStatus === 'CANCELLED'
            ? t('aiAutofillUi.conversationOperationStatus.cancelled')
            : operation.progress?.phase === 'QUEUED'
              ? t('aiAutofillUi.conversationOperationStatus.queued')
              : operation.progress?.phase === 'VALIDATING'
                ? t('aiAutofillUi.conversationOperationStatus.verifying')
                : operation.executionStatus === 'UNKNOWN'
                  ? t('aiAutofillUi.conversationOperationStatus.checkingTheResult')
                  : operation.executionStatus === 'RESULT_READY'
                    ? t('aiAutofillUi.conversationOperationStatus.finishingYourSchedule')
                    : operation.operationType === 'ADJUST'
                      ? t('aiAutofillUi.conversationOperationStatus.adjustingYourSchedule')
                      : attempt > 1
                        ? t('aiAutofillUi.conversationOperationStatus.refillingYourSchedule')
                        : t('aiAutofillUi.conversationOperationStatus.fillingYourSchedule');
    const active = operation.executionStatus === 'RUNNING' || operation.executionStatus === 'RESULT_READY';

    return (
        <div role="status" aria-label={title} aria-atomic="true" className="min-w-0">
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-[14.5px] leading-6 font-semibold break-keep text-[#333D4B]">
                    {title}{' '}
                    <span className="whitespace-nowrap">{t('aiAutofillUi.conversationOperationStatus.attemptLabel', {attempt})}</span>
                </p>
                {active && (
                    <span aria-hidden="true" className="ai-conversation-operation-dots flex shrink-0 items-center gap-1.5 py-2">
                        {[0, 1, 2].map((dot) => (
                            <span key={dot} className="ai-adjust-review-dot size-1 rounded-full bg-main-1" />
                        ))}
                    </span>
                )}
            </div>
            {operation.executionStatus === 'RUNNING' && (
                <p className="mt-1 text-[13px] leading-5 break-keep text-[#667085]">
                    {t('aiAutofillUi.conversationOperationStatus.requestedAndFixedShiftsStayInPlace')}
                </p>
            )}
            {active && operation.progress && (
                <div className="mt-2 space-y-1 text-[13px] leading-5 text-[#667085]">
                    <p aria-hidden="true">
                        {t('aiAutofillUi.conversationOperationStatus.elapsed', {seconds: Math.floor(operation.progress.elapsedMs / 1000)})}
                    </p>
                    {operation.progress.phase === 'COMPUTING' && operation.progress.elapsedMs >= 30000 && (
                        <p>{t('aiAutofillUi.conversationOperationStatus.continuing')}</p>
                    )}
                    <p>{t('aiAutofillUi.conversationOperationStatus.backgroundHint')}</p>
                </div>
            )}
        </div>
    );
}
