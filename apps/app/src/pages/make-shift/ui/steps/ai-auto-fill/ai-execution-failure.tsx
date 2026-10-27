import {Children, type ReactNode} from 'react';
import i18n from '@/i18n';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {useMakeShiftStore} from '../../../model/make-shift-store';
import {useScheduleJourneyDisplay} from '../../../model/use-schedule-journey-display';
import {AiConflictEvidence} from './ai-conflict-evidence';
import {AiConflictViolationList} from './ai-conflict-violation-list';
import {AiFailureMessage} from './ai-failure-message';

/** The failed result and the next decision belong after the preparation replies. */
export function AiExecutionFailure({
    failure,
    active = false,
    disabled = false,
    onRetry,
    onRevise,
    onReview,
    reviewLabel,
    onEditSettings,
    settingsHref,
    onInspectSchedule,
    operationType,
    attemptLabel,
    headerAction,
    children,
    detailsInChildren = false,
}: {
    failure: TAiConversationFailure;
    active?: boolean;
    disabled?: boolean;
    onRetry?: () => void;
    onRevise?: () => void;
    onReview?: () => void;
    reviewLabel?: string;
    onEditSettings?: () => void;
    settingsHref?: string;
    onInspectSchedule?: () => void;
    operationType?: 'GENERATE' | 'ADJUST';
    attemptLabel?: string;
    headerAction?: ReactNode;
    children?: ReactNode;
    detailsInChildren?: boolean;
}) {
    const {t} = useTypedTranslation();
    const displayRef = useScheduleJourneyDisplay(failure.observation);
    const teamId = useMakeShiftStore((state) => state.currentShiftTeamId);
    const settingsUrl = settingsHref ?? (teamId != null ? `${ROUTE.MEMBER}?shiftTeamId=${teamId}` : ROUTE.MEMBER);
    const actionClass =
        'flex min-h-[44px] w-full items-center justify-center rounded-[10px] px-4 py-3 text-center text-[13.5px] leading-5 font-medium break-keep transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';
    const primaryClass = `${actionClass} bg-main-1 text-white hover:bg-[#5931B9] focus-visible:bg-main-light focus-visible:text-[#43208D]`;
    const secondaryClass = `${actionClass} bg-white text-[#475467] hover:bg-main-light hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white`;
    const retryable = !failure.blocked && (!failure.recovery || failure.recovery === 'retry');
    const showSettings = failure.recovery === 'settings';
    const reviewGeneration = operationType === 'GENERATE' && Boolean(failure.confirmationRequired) && !failure.blocked;
    const showRetry = (retryable || reviewGeneration) && Boolean(onRetry);
    const showRevise =
        !failure.blocked &&
        (failure.recovery !== 'review' || (Boolean(failure.confirmationRequired) && !detailsInChildren)) &&
        !showSettings &&
        Boolean(onRevise);
    const showReview = !failure.confirmationRequired && Boolean(onReview) && (!retryable || !onRevise);
    const showConditionSettings =
        !failure.blocked &&
        (Boolean(failure.conditionConflict) || (Boolean(failure.confirmationRequired) && !detailsInChildren)) &&
        (Boolean(onEditSettings) || Boolean(failure.settingsTarget));
    const content = Children.toArray(children);
    const showActions = active && (showSettings || showRetry || showRevise || showReview || showConditionSettings);
    const title =
        failure.confirmationRequired || failure.conditionConflict
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
                {!!failure.conflicts?.length && (
                    <AiConflictEvidence failure={failure} active={active} disabled={disabled} onInspect={onInspectSchedule} />
                )}
                {!detailsInChildren && failure.conflictDetails && (
                    <div className="space-y-3 text-sm">
                        {i18n.resolvedLanguage?.startsWith('ko') && failure.conflictDetails.explanation?.trim() && (
                            <p className="whitespace-pre-wrap">{failure.conflictDetails.explanation}</p>
                        )}
                        <AiConflictViolationList review={failure.conflictDetails} />
                    </div>
                )}
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
                                {t(reviewGeneration ? 'aiAdjust.executionFailure.retryConditions' : 'aiAdjust.failure.retry')}
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
                        {showConditionSettings &&
                            (failure.settingsTarget === 'member' || !onEditSettings ? (
                                <a className={secondaryClass} href={settingsUrl} target="_blank" rel="noopener noreferrer">
                                    {t('aiAdjust.executionFailure.memberSettings')}
                                </a>
                            ) : (
                                <button type="button" className={secondaryClass} disabled={disabled} onClick={onEditSettings}>
                                    {t('aiAutofillUi.conflictReview.editSettings')}
                                </button>
                            ))}
                        {showReview && !showConditionSettings && (
                            <button
                                type="button"
                                className={showSettings || showRetry || showRevise ? secondaryClass : primaryClass}
                                disabled={disabled}
                                onClick={onReview}
                            >
                                {reviewLabel ?? t('aiAdjust.executionFailure.review')}
                            </button>
                        )}
                    </div>
                )}
            </AiFailureMessage>
        </div>
    );
}
