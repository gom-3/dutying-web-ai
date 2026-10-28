import type {MouseEventHandler, ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import {authoringMessageKey, authoringOutcome} from '../../../model/intent-first-authoring';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiConversationFeedbackButton} from './ai-conversation-feedback-button';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export function AiConversationResult({
    operation,
    appliedLocally = false,
    attempt,
    feedbackDisabled,
    preview,
    children,
    actions,
    onReport,
}: {
    operation: TConversationOperation;
    appliedLocally?: boolean;
    attempt: number;
    feedbackDisabled: boolean;
    preview?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    onReport: MouseEventHandler<HTMLButtonElement>;
    copy: (ko: string, en: string) => string;
}) {
    const {t} = useTypedTranslation();
    const authoring = operation.result ? authoringOutcome(operation.result) : undefined;
    const messageKey = operation.result ? authoringMessageKey(operation.result) : undefined;
    const review = operation.result && isGenerateReviewDraft(operation.result);
    const saved = operation.applyStatus === 'APPLIED';
    const applied = saved && appliedLocally;
    const visibleMessageKey = saved ? undefined : messageKey;
    const appliedStatusKey =
        applied && authoring?.requestState === 'NEEDS_REVIEW'
            ? 'selectedReview'
            : applied && authoring?.requestState === 'PARTIAL'
              ? 'PARTIAL'
              : undefined;
    const succeeded =
        operation.executionStatus === 'SUCCEEDED' &&
        applied &&
        (!authoring ||
            (authoring.draftState === 'APPLICABLE' &&
                !['PARTIAL', 'NEEDS_REVIEW', 'UNSATISFIED', 'NO_IMPROVEMENT'].includes(authoring.requestState)));
    const changedCount = operation.result?.changedCells.length;
    const showPartialCoverage = !applied && authoring?.validation.coverage === 'PARTIAL' && !operation.result?.candidate;
    const title = appliedStatusKey
        ? t(`aiConversationSidebar.authoring.${appliedStatusKey}`)
        : review
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
            title={
                applied
                    ? title
                    : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
                      ? t('aiConversationSidebar.sourceChangedNotApplied')
                      : visibleMessageKey
                        ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                        : title
            }
            attempt={attempt}
            outcome={
                !applied && (review || (authoring && ['CONSENT_REQUIRED', 'PREVIEW_ONLY'].includes(authoring.draftState)))
                    ? 'review'
                    : succeeded
                      ? 'success'
                      : 'neutral'
            }
            outcomeLabel={
                !applied && visibleMessageKey
                    ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                    : !applied
                      ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
                      : appliedStatusKey
                        ? t(`aiConversationSidebar.authoring.${appliedStatusKey}`)
                        : operation.operationType === 'GENERATE'
                          ? t('aiAutofillUi.conversationResult.autofillSucceeded')
                          : t('aiAutofillUi.conversationResult.adjustmentSucceeded')
            }
            changedCount={changedCount}
            description={
                authoring
                    ? applied
                        ? null
                        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
                          ? scope
                          : null
                    : review
                      ? t('aiAutofillUi.conversationResult.reviewTheHighlightedRulesAndAdjustShiftsWhereNeeded')
                      : scope
            }
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
            {showPartialCoverage && (
                <p role="status" className="mt-3 text-[13px] leading-6">
                    {t('aiConversationSidebar.authoring.partialCoverage')}
                </p>
            )}
            {children}
        </AiScheduleResultCard>
    );
}
