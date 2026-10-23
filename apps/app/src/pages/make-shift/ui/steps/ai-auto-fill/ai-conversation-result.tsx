import type {MouseEventHandler, ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiConversationFeedbackButton} from './ai-conversation-feedback-button';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export function AiConversationResult({
    operation,
    attempt,
    feedbackDisabled,
    preview,
    children,
    actions,
    onReport,
}: {
    operation: TConversationOperation;
    attempt: number;
    feedbackDisabled: boolean;
    preview?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    onReport: MouseEventHandler<HTMLButtonElement>;
    copy: (ko: string, en: string) => string;
}) {
    const {t} = useTypedTranslation();
    const review = operation.result && isGenerateReviewDraft(operation.result);
    const applied = operation.applyStatus === 'APPLIED';
    const succeeded = operation.executionStatus === 'SUCCEEDED' && applied && !review;
    const changedCount = operation.result?.changedCells.length;
    const title = review
        ? t('aiAutofillUi.conversationResult.yourScheduleDraftIsReady')
        : !applied
          ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
          : operation.operationType === 'GENERATE'
            ? t('aiAutofillUi.conversationResult.yourScheduleIsReady')
            : changedCount === 0
              ? t('aiAutofillUi.conversationResult.noShiftsChangedThisTime')
              : t('aiAutofillUi.conversationResult.yourAdjustedScheduleIsReady');
    const scope = applied
        ? null
        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
          ? t('aiAutofillUi.conversationResult.yourDraftChangedSoThisResultWasNotAppliedReviewItBeforeContinuing')
          : t('aiAutofillUi.conversationResult.thisResultHasNotBeenAppliedToTheCurrentScheduleReviewItBeforeContinuing');

    return (
        <AiScheduleResultCard
            title={title}
            attempt={attempt}
            outcome={review ? 'review' : succeeded ? 'success' : 'neutral'}
            outcomeLabel={
                review
                    ? t('aiAutofillUi.conversationResult.scheduleNeedsReview')
                    : operation.operationType === 'GENERATE'
                      ? t('aiAutofillUi.conversationResult.autofillSucceeded')
                      : t('aiAutofillUi.conversationResult.adjustmentSucceeded')
            }
            changedCount={changedCount}
            description={review ? t('aiAutofillUi.conversationResult.reviewTheHighlightedRulesAndAdjustShiftsWhereNeeded') : scope}
            preview={preview}
            headerAction={
                <AiConversationFeedbackButton
                    label={t('aiAutofillUi.conversationResult.sendFeedbackOnThisResult')}
                    disabled={feedbackDisabled}
                    onClick={onReport}
                />
            }
            actions={actions}
        >
            {children}
        </AiScheduleResultCard>
    );
}
