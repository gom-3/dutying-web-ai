import type {TAutofillResponse} from '@dutying/api/ward';
import i18n from '@/i18n';
import type {TAiConversationFailure} from './ai-conversation-failure';

/** Explain a rejected result without treating an unverified result as proven infeasibility. */
export function aiExecutionFailure(response: TAutofillResponse): TAiConversationFailure | null {
    const status = response.engineResult?.status?.toUpperCase();
    const reason = (response.failure?.reasonCode ?? response.engineResult?.solver?.reason ?? '').toUpperCase();

    if (
        response.applicable !== false &&
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
