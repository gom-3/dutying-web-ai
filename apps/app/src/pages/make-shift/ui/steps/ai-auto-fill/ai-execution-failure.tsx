import {Children, type ReactNode} from 'react';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {useMakeShiftStore} from '../../../model/make-shift-store';
import {useScheduleJourneyDisplay} from '../../../model/use-schedule-journey-display';
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
    attemptLabel,
    headerAction,
    children,
}: {
    failure: TAiConversationFailure;
    active?: boolean;
    disabled?: boolean;
    onRetry?: () => void;
    onRevise?: () => void;
    onReview?: () => void;
    operationType?: 'GENERATE' | 'ADJUST';
    attemptLabel?: string;
    headerAction?: ReactNode;
    children?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const displayRef = useScheduleJourneyDisplay(failure.observation);
    const teamId = useMakeShiftStore((state) => state.currentShiftTeamId);
    const settingsUrl = teamId != null ? `${ROUTE.MEMBER}?shiftTeamId=${teamId}` : ROUTE.MEMBER;
    const actionClass =
        'flex min-h-[44px] w-full items-center justify-center rounded-[10px] px-4 py-3 text-center text-[13.5px] leading-5 font-medium break-keep transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
    const primaryClass = `${actionClass} bg-main-1 text-white hover:bg-[#5931B9] focus-visible:bg-main-light focus-visible:text-[#43208D]`;
    const secondaryClass = `${actionClass} bg-white text-[#475467] hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white`;
    const retryable = !failure.blocked && (!failure.recovery || failure.recovery === 'retry');
    const showSettings = failure.recovery === 'settings';
    const showRetry = retryable && Boolean(onRetry);
    const showRevise = !failure.blocked && failure.recovery !== 'review' && !showSettings && Boolean(onRevise);
    const showReview = Boolean(onReview) && (!retryable || !onRevise);
    const content = Children.toArray(children);
    const showActions = active && (showSettings || showRetry || showRevise || showReview);
    const title = failure.confirmationRequired
        ? t('aiAdjust.executionFailure.conflictTitle')
        : failure.recovery === 'settings'
          ? t('aiAdjust.executionFailure.offSettingsTitle')
          : operationType
            ? t(operationType === 'GENERATE' ? 'aiAdjust.executionFailure.autofillTitle' : 'aiAdjust.executionFailure.adjustTitle')
            : t('aiAdjust.failure.title');

    return (
        <div ref={displayRef} className="flex min-w-0 flex-col gap-4">
            <AiFailureMessage
                message={failure.message}
                title={attemptLabel ? `${title} (${attemptLabel})` : title}
                headerAction={headerAction}
            >
                {!!content.length && <div className="space-y-3">{content}</div>}
                {showActions && (
                    <div className={`grid w-full gap-2 ${content.length ? 'mt-4' : ''}`}>
                        {showSettings && (
                            <a className={primaryClass} href={settingsUrl} target="_blank" rel="noopener noreferrer">
                                {t('aiAdjust.executionFailure.memberSettings')}
                            </a>
                        )}
                        {showRetry && (
                            <button type="button" className={primaryClass} disabled={disabled} onClick={onRetry}>
                                {t('aiAdjust.failure.retry')}
                            </button>
                        )}
                        {showRevise && (
                            <button
                                type="button"
                                className={showRetry ? secondaryClass : primaryClass}
                                disabled={disabled}
                                onClick={onRevise}
                            >
                                {t('aiAdjust.issue.edit')}
                            </button>
                        )}
                        {showReview && (
                            <button
                                type="button"
                                className={showSettings || showRetry || showRevise ? secondaryClass : primaryClass}
                                disabled={disabled}
                                onClick={onReview}
                            >
                                {t('aiAdjust.executionFailure.review')}
                            </button>
                        )}
                    </div>
                )}
            </AiFailureMessage>
        </div>
    );
}
