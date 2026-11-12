import type {ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {isGenerateReviewDraft, pairedNightStaffingMessage} from '../../../model/ai-execution-failure';
import {authoringExplanationKey, authoringMessageKey, authoringOutcome} from '../../../model/intent-first-authoring';
import type {TConversationOperation} from '../../../model/schedule-conversation-api';
import {AiRequestOutcome} from './ai-request-outcome';
import {AiScheduleResultCard} from './ai-schedule-result-card';

export function AiConversationResult({
    operation,
    appliedLocally = false,
    undone = false,
    dismissDetails = false,
    attempt,
    preview,
    changeSummary,
    children,
    actions,
    secondaryActions,
}: {
    operation: TConversationOperation;
    appliedLocally?: boolean;
    undone?: boolean;
    dismissDetails?: boolean;
    attempt: number;
    preview?: ReactNode;
    changeSummary?: ReactNode | ((inline: boolean) => ReactNode);
    children?: ReactNode;
    actions?: ReactNode;
    secondaryActions?: ReactNode;
    copy: (ko: string, en: string) => string;
}) {
    const {t} = useTypedTranslation();
    const {result} = operation;
    const authoring = result ? authoringOutcome(result) : undefined;
    const requestState = authoring?.requestState;
    const messageKey = result ? authoringMessageKey(result) : undefined;
    const explanationKey = result ? authoringExplanationKey(result) : undefined;
    const staffingFloor =
        result && authoring?.reasonCodes?.includes('PAIRED_NIGHT_STAFFING_FLOOR') ? pairedNightStaffingMessage(result) : null;
    const review = result ? isGenerateReviewDraft(result) : false;
    const saved = operation.applyStatus === 'APPLIED' || appliedLocally;
    const savedForLater = operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED' && !appliedLocally && Boolean(operation.resultVersionId);
    const applied = saved && appliedLocally;
    const visibleMessageKey = saved ? undefined : messageKey;
    const appliedStatusKey =
        saved && requestState === 'NEEDS_REVIEW' ? 'selectedReview' : saved && requestState === 'PARTIAL' ? 'PARTIAL' : undefined;
    const changedCount = result?.changedCells.length;
    const hasChanges = changedCount !== undefined && changedCount > 0;
    const completedChanges = operation.executionStatus === 'SUCCEEDED' && hasChanges;
    const historical = !appliedLocally && (undone || (saved && Boolean(operation.resultVersionId) && hasChanges));
    const compactResult = historical || (completedChanges && (appliedLocally || savedForLater));
    const showPartialCoverage = authoring?.validation.coverage === 'PARTIAL' && !result?.candidate;
    const hasUnmetConditions =
        requestState === 'PARTIAL' ||
        requestState === 'UNSATISFIED' ||
        authoring?.clauses.some((clause) => clause.status === 'UNSATISFIED') === true;
    const needsReview =
        hasUnmetConditions ||
        requestState === 'NEEDS_REVIEW' ||
        requestState === 'NO_IMPROVEMENT' ||
        authoring?.clauses.some((clause) => clause.status === 'UNVERIFIED') === true ||
        showPartialCoverage ||
        review ||
        result?.reviewRequired === true ||
        Boolean(result?.conflictReview);
    const appliedWithReview = saved && completedChanges && needsReview;
    const succeeded = saved && completedChanges && !needsReview && (!authoring || authoring.draftState === 'APPLICABLE');
    const previewNeedsReview =
        !saved && (review || authoring?.draftState === 'CONSENT_REQUIRED' || authoring?.draftState === 'PREVIEW_ONLY');
    const outcome = historical ? 'neutral' : appliedWithReview || previewNeedsReview ? 'review' : succeeded ? 'success' : 'neutral';
    const reviewSummary = appliedWithReview
        ? t(
              hasUnmetConditions
                  ? 'aiAutofillUi.conversationResult.conditionsStillUnmet'
                  : 'aiAutofillUi.conversationResult.conditionsToReview',
          )
        : undefined;
    const changeTitle = t('aiAutofillUi.conversationResult.appliedChangeCount', {count: changedCount ?? 0});
    const title = appliedWithReview
        ? changeTitle
        : appliedStatusKey
          ? t(`aiConversationSidebar.authoring.${appliedStatusKey}`)
          : review
            ? t('aiAutofillUi.conversationResult.yourScheduleDraftIsReady')
            : !saved || changedCount === undefined
              ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
              : !hasChanges
                ? t('aiAutofillUi.conversationResult.noShiftsChangedThisTime')
                : operation.operationType === 'GENERATE'
                  ? t('aiAutofillUi.conversationResult.yourScheduleIsReady')
                  : changeTitle;
    const scope = saved
        ? null
        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
          ? t('aiConversationSidebar.draftChangedResultSaved')
          : t('aiAutofillUi.conversationResult.thisResultHasNotBeenAppliedToTheCurrentScheduleReviewItBeforeContinuing');

    return (
        <AiScheduleResultCard
            title={
                historical
                    ? t(undone ? 'aiConversationSidebar.authoring.changesUndone' : 'aiConversationSidebar.authoring.previousResult')
                    : appliedLocally && succeeded
                      ? t(
                            operation.operationType === 'GENERATE'
                                ? 'aiAutofillUi.conversationResult.completedTitle'
                                : 'aiAutofillUi.conversationResult.updatedTitle',
                        )
                      : saved && changedCount !== undefined
                        ? title
                        : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
                          ? t('aiConversationSidebar.sourceChangedNotApplied')
                          : visibleMessageKey
                            ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                            : title
            }
            summary={
                historical
                    ? undefined
                    : savedForLater && compactResult
                      ? t('aiAutofillUi.conversationResult.savedForLaterHint')
                      : reviewSummary
            }
            attempt={saved || savedForLater ? undefined : attempt}
            outcome={outcome}
            outcomeLabel={
                appliedWithReview
                    ? t('aiAutofillUi.conversationResult.scheduleNeedsReview')
                    : visibleMessageKey
                      ? t(`aiConversationSidebar.authoring.${visibleMessageKey}`)
                      : !saved
                        ? t('aiAutofillUi.conversationResult.yourScheduleResultIsReady')
                        : t(
                              operation.operationType === 'GENERATE'
                                  ? 'aiAutofillUi.conversationResult.autofillSucceeded'
                                  : 'aiAutofillUi.conversationResult.adjustmentSucceeded',
                          )
            }
            changedCount={saved || savedForLater || historical ? changedCount : undefined}
            changedPeople={
                (saved || savedForLater || historical) && result
                    ? new Set(result.changedCells.map((cell) => cell.shiftNurseId)).size
                    : undefined
            }
            compact={compactResult}
            historical={historical}
            dismissDetails={dismissDetails}
            changeSummary={
                saved || savedForLater ? (typeof changeSummary === 'function' ? changeSummary(compactResult) : changeSummary) : undefined
            }
            description={
                historical
                    ? t('aiConversationSidebar.authoring.savedResult')
                    : authoring
                      ? applied
                          ? null
                          : operation.applyStatus === 'NOT_APPLIED_SOURCE_CHANGED'
                            ? scope
                            : !saved && explanationKey
                              ? t(`aiConversationSidebar.authoring.${explanationKey}`)
                              : null
                      : review
                        ? t('aiAutofillUi.conversationResult.reviewTheHighlightedRulesAndAdjustShiftsWhereNeeded')
                        : scope
            }
            preview={preview}
            actions={historical && undone ? undefined : actions}
            secondaryActions={secondaryActions}
        >
            {!historical && staffingFloor && <p className="mt-3 text-[13px] leading-6">{staffingFloor}</p>}
            {showPartialCoverage && (
                <p role="status" className="mt-3 text-[13px] leading-6">
                    {t('aiConversationSidebar.authoring.partialCoverage')}
                </p>
            )}
            {result && <AiRequestOutcome result={result} showChangedSummary={!compactResult && !historical} />}
            {children}
        </AiScheduleResultCard>
    );
}
