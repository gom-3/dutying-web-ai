import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft} from '../../../model/ai-execution-failure';
import {authoringMessageKey, authoringOutcome} from '../../../model/intent-first-authoring';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export function AiConversationResult({
    operation,
    appliedLocally = false,
    attempt,
    preview,
    changeSummary,
    children,
    actions,
}: {
    operation: TConversationOperation;
    appliedLocally?: boolean;
    attempt: number;
    preview?: ReactNode;
    changeSummary?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
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
        saved && authoring?.requestState === 'NEEDS_REVIEW'
            ? 'selectedReview'
            : saved && authoring?.requestState === 'PARTIAL'
              ? 'PARTIAL'
              : undefined;
    const changedCount = operation.result?.changedCells.length;
    const succeeded =
        operation.executionStatus === 'SUCCEEDED' &&
        saved &&
        changedCount !== undefined &&
        changedCount > 0 &&
        (!authoring ||
            (authoring.draftState === 'APPLICABLE' &&
                !['PARTIAL', 'NEEDS_REVIEW', 'UNSATISFIED', 'NO_IMPROVEMENT'].includes(authoring.requestState)));
    const showPartialCoverage = !saved && authoring?.validation.coverage === 'PARTIAL' && !operation.result?.candidate;
    const title = appliedStatusKey
        ? t(`aiConversationSidebar.authoring.${appliedStatusKey}`)
        : review
          ? t('aiAutofillUi.conversationResult.yourScheduleDraftIsReady')
          : !saved || changedCount === undefined
            ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
            : operation.operationType === 'GENERATE'
              ? changedCount === 0
                  ? t('aiAutofillUi.conversationResult.noShiftsChangedThisTime')
                  : t('aiAutofillUi.conversationResult.yourScheduleIsReady')
              : changedCount === 0
                ? t('aiAutofillUi.conversationResult.noShiftsChangedThisTime')
                : t('aiAutofillUi.conversationResult.yourAdjustedScheduleIsReady', {count: changedCount});
    const scope = saved
        ? null
        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
          ? t('aiAutofillUi.conversationResult.yourDraftChangedSoThisResultWasNotAppliedReviewItBeforeContinuing')
          : t('aiAutofillUi.conversationResult.thisResultHasNotBeenAppliedToTheCurrentScheduleReviewItBeforeContinuing');

    return (
        <AiScheduleResultCard
            title={
                saved && changedCount !== undefined
                    ? title
                    : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
                      ? t('aiConversationSidebar.sourceChangedNotApplied')
                      : visibleMessageKey
                        ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                        : title
            }
            attempt={saved ? undefined : attempt}
            outcome={
                !saved && (review || (authoring && ['CONSENT_REQUIRED', 'PREVIEW_ONLY'].includes(authoring.draftState)))
                    ? 'review'
                    : succeeded
                      ? 'success'
                      : 'neutral'
            }
            outcomeLabel={
                !saved && visibleMessageKey
                    ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                    : !saved
                      ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
                      : appliedStatusKey
                        ? t(`aiConversationSidebar.authoring.${appliedStatusKey}`)
                        : operation.operationType === 'GENERATE'
                          ? t('aiAutofillUi.conversationResult.autofillSucceeded')
                          : t('aiAutofillUi.conversationResult.adjustmentSucceeded')
            }
            changedCount={saved ? changedCount : undefined}
            changeSummary={saved ? changeSummary : undefined}
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
