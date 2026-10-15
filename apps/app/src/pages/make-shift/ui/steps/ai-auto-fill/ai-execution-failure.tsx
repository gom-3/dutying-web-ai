import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {AiFailureMessage} from './ai-failure-message';

/** The failed result and the next decision belong after the preparation replies. */
export function AiExecutionFailure({
    failure,
    active = false,
    disabled = false,
    onRetry,
    onRevise,
    onReview,
    operationType,
}: {
    failure: TAiConversationFailure;
    active?: boolean;
    disabled?: boolean;
    onRetry?: () => void;
    onRevise?: () => void;
    onReview?: () => void;
    operationType?: 'GENERATE' | 'ADJUST';
}) {
    const {t} = useTypedTranslation();
    const choiceClass =
        'min-h-11 max-w-full rounded-xl bg-main-light px-4 py-3 text-left text-[13.5px] leading-5 font-medium text-[#5931B9] hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';
    const retryable = !failure.blocked && (!failure.recovery || failure.recovery === 'retry');

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <AiFailureMessage
                message={failure.message}
                title={
                    operationType
                        ? t(
                              operationType === 'GENERATE'
                                  ? 'aiAdjust.executionFailure.autofillTitle'
                                  : 'aiAdjust.executionFailure.adjustTitle',
                          )
                        : undefined
                }
            />
            {active && (
                <div className="ml-auto flex max-w-full flex-col items-end gap-2">
                    {retryable && onRetry && (
                        <button type="button" className={choiceClass} disabled={disabled} onClick={onRetry}>
                            {t('aiAdjust.failure.retry')}
                        </button>
                    )}
                    {!failure.blocked && failure.recovery !== 'review' && onRevise && (
                        <button type="button" className={choiceClass} disabled={disabled} onClick={onRevise}>
                            {t('aiAdjust.issue.edit')}
                        </button>
                    )}
                    {onReview && (!retryable || !onRevise) && (
                        <button type="button" className={choiceClass} disabled={disabled} onClick={onReview}>
                            {t('aiAdjust.executionFailure.review')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
