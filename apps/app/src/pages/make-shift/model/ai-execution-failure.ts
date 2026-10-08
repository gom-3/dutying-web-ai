import type {TAutofillResponse} from '@dutying/api/ward';
import i18n from '@/i18n';
import {aiConversationFailure, type TAiConversationFailure} from './ai-conversation-failure';
import type {TConversationOperation} from './schedule-conversation-api';

export function conversationOperationFailure(operation: TConversationOperation): TAiConversationFailure | null {
    return (
        (operation.result ? aiExecutionFailure(operation.result) : null) ??
        (operation.executionStatus === 'FAILED'
            ? aiConversationFailure({serverCode: operation.failureReason ?? undefined}, i18n.t('aiAdjust.executionFailure.unknown'))
            : null)
    );
}

/** Only explicit, revalidated GENERATE review drafts may bypass the approval verdict. */
export function isGenerateReviewDraft(response: TAutofillResponse): boolean {
    return (
        response.operationType === 'GENERATE' &&
        response.applicable === true &&
        response.validationTarget === 'RESULT' &&
        ['REJECTED', 'ACCEPTED', 'REPAIRED'].includes(response.engineResult?.status ?? '') &&
        response.approvable === false &&
        response.engineResult?.candidateVisible === true &&
        response.engineResult?.reviewRequired === true &&
        response.changedCells.length > 0 &&
        response.changedCells.every((cell) => cell.wardShiftTypeId != null)
    );
}

/** Explain a rejected result without treating an unverified result as proven infeasibility. */
export function aiExecutionFailure(response: TAutofillResponse): TAiConversationFailure | null {
    if (isGenerateReviewDraft(response)) return null;

    const status = response.engineResult?.status?.toUpperCase();
    const reason = (
        response.failure?.reasonCode ??
        response.engineResult?.solver?.reason ??
        (response.engineResult?.reviewRequired === true ? 'SPRING_HARD_VALIDATION' : '')
    ).toUpperCase();

    if (
        response.applicable !== false &&
        response.engineResult?.reviewRequired !== true &&
        !['REJECTED', 'ERROR', 'INFEASIBLE', 'TIME_LIMIT'].includes(status ?? '') &&
        reason !== 'TIME_LIMIT_NO_SOLUTION'
    )
        return null;

    let key: 'infeasible' | 'timeLimit' | 'validation' | 'incomplete' | 'rules' | 'unsupported' | 'lockedEmpty' | 'input' | 'unknown' =
        'unknown';
    let recovery: NonNullable<TAiConversationFailure['recovery']> = 'retry';

    if (reason.includes('UNSUPPORTED')) {
        key = 'unsupported';
        recovery = 'revise';
    } else if (reason === 'CONTRACT_LOCKED_EMPTY_CELL') {
        key = 'lockedEmpty';
        recovery = 'review';
    } else if (/^(CONTRACT_|INVALID_|MISSING_)/.test(reason)) {
        key = 'input';
        recovery = 'review';
    } else if (status === 'INFEASIBLE' || reason === 'HARD_RULE_CONFLICT') {
        key = 'infeasible';
        recovery = 'revise';
    } else if (status === 'TIME_LIMIT' || reason.includes('TIME_LIMIT')) {
        key = 'timeLimit';
    } else if (reason === 'SOLVER_RESULT_VALIDATION_UNAVAILABLE') {
        key = 'validation';
    } else if (reason === 'SOLVER_RESULT_INCOMPLETE') {
        key = 'incomplete';
    } else if (reason === 'SOLVER_RESULT_FAILED_FINAL_GATE' || reason === 'SPRING_HARD_VALIDATION') {
        key = 'rules';
        recovery = 'revise';
    }

    return {message: i18n.t(`aiAdjust.executionFailure.${key}`), blocked: false, recovery};
}
