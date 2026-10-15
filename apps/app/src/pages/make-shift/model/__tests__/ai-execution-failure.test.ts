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
