import type {TAutofillResponse} from '@dutying/api/ward';
import {describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {aiExecutionFailure} from '../ai-execution-failure';

describe('execution failure reasons', () => {
    it.each([
        ['ENGINE_CONNECTION_FAILED', 'connection'],
        ['ENGINE_TIMEOUT', 'timeout'],
        ['ENGINE_BUSY', 'busy'],
        ['ENGINE_INVALID_RESPONSE', 'response'],
        ['ENGINE_RESPONSE_ERROR', 'response'],
        ['HARD_RULE_CONFLICT', 'infeasible'],
        ['SEMANTIC_RESULT_UNSATISFIED', 'rules'],
        ['TIME_LIMIT', 'unavailable'],
        ['UNKNOWN', 'unknown'],
    ])('explains %s without guessing a condition conflict', (reason, key) => {
        const response: TAutofillResponse = {
            operationType: 'GENERATE',
            draftRevision: 1,
            resultType: 'PATCH',
            validation: {
                draftRevision: 1,
                rulesHash: 'test',
                summary: {valid: false, hardCount: 0, softCount: 0, totalCount: 0},
                violations: [],
            },
            unmetInstructions: [],
            sameAsPrevious: true,
            applicable: false,
            changedCells: [],
            engineResult: {status: 'ERROR'},
            failure: {reasonCode: reason, message: 'test'},
        };
        const failure = aiExecutionFailure(response);

        expect(failure?.message).toBe(i18n.t(`aiAdjust.executionFailure.${key}`));
        expect(failure?.recovery).toBe(['HARD_RULE_CONFLICT', 'SEMANTIC_RESULT_UNSATISFIED'].includes(reason) ? 'revise' : 'retry');
    });
});

describe('rest eligibility is a configuration issue', () => {
    function rejected(solverReason: string, status = 'REJECTED'): TAutofillResponse {
        return {
            operationType: 'GENERATE',
            draftRevision: 1,
            resultType: 'PATCH',
            changedCells: [],
            applicable: false,
            unmetInstructions: [],
            sameAsPrevious: true,
            validation: {
                draftRevision: 1,
                rulesHash: 'test',
                summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                violations: [],
            },
            engineResult: {status, solver: {reason: solverReason}},
        };
    }
    it.each(['contract_nurse_off_not_allowed', 'nurse_has_no_assignable_off'])('handles %s before generic infeasibility', (reason) => {
        const response = rejected(reason, 'INFEASIBLE');
        response.failure = {reasonCode: 'HARD_RULE_CONFLICT', message: 'java.lang.INTERNAL_ERROR'};
        const failure = aiExecutionFailure(response);
        expect(failure?.recovery).toBe('settings');
        expect(failure?.message).toContain('구성원 설정');
        expect(failure?.message).not.toMatch(/고정한 근무|java\.|INFEASIBLE/);
    });
    it('names affected nurses from structured data and ignores arbitrary server text', () => {
        const response = rejected('contract_nurse_off_not_allowed');
        response.failure = {
            reasonCode: 'NURSE_OFF_NOT_ALLOWED',
            message: 'traceback: INTERNAL',
            affectedNurses: [
                {shiftNurseId: 1, name: '수간호사'},
                {shiftNurseId: 2, name: '책임간호사'},
            ],
        };
        const failure = aiExecutionFailure(response);
        expect(failure?.message).toContain('수간호사, 책임간호사');
        expect(failure?.message).not.toContain('traceback');
        expect(failure?.recovery).toBe('settings');
    });
});

describe('verified generation alternatives', () => {
    function rejected(): TAutofillResponse {
        return {
            operationType: 'GENERATE',
            draftRevision: 1,
            resultType: 'PATCH',
            changedCells: [],
            applicable: false,
            unmetInstructions: [],
            sameAsPrevious: true,
            validation: {
                draftRevision: 1,
                rulesHash: 'test',
                summary: {valid: false, hardCount: 0, softCount: 0, totalCount: 0},
                violations: [],
            },
            engineResult: {status: 'INFEASIBLE'},
            failure: {
                reasonCode: 'HARD_RULE_CONFLICT',
                message: 'traceback: do not render',
                affectedNurses: [{shiftNurseId: 20, name: '테스트 간호사'}],
                diagnosis: {status: 'VERIFIED_ALTERNATIVE', ruleId: 50, shiftNurseId: 20, currentMax: 2, proposedMax: 4},
            },
        };
    }
    it('shows the nurse, exact change, verification and a review step', () => {
        const failure = aiExecutionFailure(rejected());
        expect(failure?.message).toContain('테스트 간호사');
        expect(failure?.message).toContain('2회에서 4회');
        expect(failure?.message).toContain('다른 필수 조건과 고정 근무');
        expect(failure?.message).toContain('대안 중 하나');
        expect(failure?.message).toContain('아직 바뀌지 않았');
        expect(failure?.message).not.toContain('traceback');
        expect(failure?.recovery).toBe('revise');
    });
    it('does not show stale alternatives for timeouts', () => {
        const response = rejected();
        response.engineResult!.status = 'TIME_LIMIT';
        response.failure!.reasonCode = 'TIME_LIMIT';
        expect(aiExecutionFailure(response)?.message).not.toContain('2회에서 4회');
    });
    it.each(['missing-nurse', 'invalid-count'] as const)('falls back safely for %s', (mode) => {
        const response = rejected();
        if (mode === 'missing-nurse') response.failure!.affectedNurses = [];
        else response.failure!.diagnosis!.proposedMax = -1;
        expect(aiExecutionFailure(response)?.message).toBe(i18n.t('aiAdjust.executionFailure.infeasible'));
    });
});
