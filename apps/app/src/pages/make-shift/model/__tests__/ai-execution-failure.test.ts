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
        ['SEMANTIC_RESULT_UNSATISFIED', 'resultCheck'],
        ['SOLVER_RESULT_FAILED_FINAL_GATE', 'resultCheck'],
        ['SPRING_HARD_VALIDATION', 'resultCheck'],
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
        expect(failure?.recovery).toBe(reason === 'HARD_RULE_CONFLICT' ? 'revise' : 'retry');
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
        expect(failure?.message).toContain('미리 정한 근무와 다른 설정');
        expect(failure?.message).toContain('늘려도 괜찮은지 확인');
        expect(failure?.message).toContain('아직 설정이나 근무표가 변경되지는 않았');
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

it('allows only an explicitly confirmed server exception through the failure gate', () => {
    const response = {
        operationType: 'ADJUST' as const,
        applicable: true,
        approvable: true,
        confirmedConstraintException: true,
        changedCells: [],
        validation: {summary: {hardCount: 1}},
        engineResult: {status: 'ACCEPTED', reviewRequired: false},
    } as unknown as Parameters<typeof aiExecutionFailure>[0];
    expect(aiExecutionFailure(response)).toBeNull();
    expect(aiExecutionFailure({...response, confirmedConstraintException: false})).not.toBeNull();
    expect(aiExecutionFailure({...response, engineResult: {status: 'REJECTED'}})).not.toBeNull();
    expect(aiExecutionFailure({...response, applicable: false})).not.toBeNull();
});

describe('fixed rest target conflict', () => {
    it.each(['ko', 'en'])('shows the conflicting counts and a review action in %s', async (language) => {
        const previous = i18n.language;
        try {
            await i18n.changeLanguage(language);
            const response = {
                operationType: 'GENERATE',
                applicable: false,
                changedCells: [],
                draftRevision: 1,
                resultType: 'PATCH',
                unmetInstructions: [],
                sameAsPrevious: true,
                validation: {
                    draftRevision: 1,
                    rulesHash: 'test',
                    summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                    violations: [],
                },
                engineResult: {status: 'INFEASIBLE'},
                failure: {
                    reasonCode: 'MONTHLY_REST_TARGET_CONFLICT',
                    message: 'internal text must not be displayed',
                    restTargetConflicts: [
                        {shiftNurseId: 1, name: 'Nurse A', minimum: 9, maximum: 9, fixedRestDays: 10, availableRestDays: 20},
                    ],
                },
            } as TAutofillResponse;
            const failure = aiExecutionFailure(response);
            expect(failure?.recovery).toBe('review');
            expect(failure?.message).toContain('Nurse A');
            expect(failure?.message).toContain('10');
            expect(failure?.message).toContain('9');
            expect(failure?.message).not.toContain('internal text');
            response.failure!.restTargetConflicts![0].fixedRestDays = 100;
            expect(aiExecutionFailure(response)?.message).not.toContain('100');
        } finally {
            await i18n.changeLanguage(previous);
        }
    });
});

describe('proven staffing conflict details', () => {
    const response = (status: string, minimum: unknown, maximum: unknown): TAutofillResponse => ({
        operationType: 'GENERATE',
        draftRevision: 1,
        resultType: 'PATCH',
        applicable: false,
        changedCells: [],
        unmetInstructions: [],
        sameAsPrevious: true,
        validation: {
            draftRevision: 1,
            rulesHash: 'test',
            summary: {valid: false, hardCount: 0, softCount: 0, totalCount: 0},
            violations: [],
        },
        engineResult: {status, violations: [{type: 'STAFF_COUNT_BOUNDS_CONFLICT', date: '2026-11-02', shiftCode: 'N12', minimum, maximum}]},
    });
    it('keeps the concrete conflict visible even when no verified proposal exists', () => {
        const failure = aiExecutionFailure(response('INFEASIBLE', 4, 3));
        expect(failure?.message).toContain('2026-11-02');
        expect(failure?.message).toContain('최소 4명과 최대 3명');
        expect(failure?.conditionConflict).toBe(true);
        expect(failure?.confirmationRequired).not.toBe(true);
        expect(failure?.recovery).toBe('revise');
    });
    it.each([
        ['REJECTED', 4, 3],
        ['INFEASIBLE', 3, 4],
        ['INFEASIBLE', '4', 3],
        ['INFEASIBLE', 4, -1],
    ])('does not claim a proven conflict from invalid evidence %s %s %s', (status, minimum, maximum) => {
        expect(aiExecutionFailure(response(String(status), minimum, maximum))?.conditionConflict).not.toBe(true);
    });
});

describe('monthly staffing capacity evidence', () => {
    const issue = {
        type: 'MONTHLY_STAFFING_CAPACITY_CONFLICT',
        shiftCodes: ['D', 'E'],
        minimumAssignments: 204,
        maximumAssignments: 180,
        excessAssignments: 24,
    };
    function response(review = false): TAutofillResponse {
        return {
            operationType: 'GENERATE',
            draftRevision: 1,
            resultType: 'PATCH',
            changedCells: [],
            applicable: false,
            sameAsPrevious: true,
            unmetInstructions: [],
            validation: {
                draftRevision: 1,
                rulesHash: 'test',
                summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                violations: [],
            },
            engineResult: {
                status: review ? 'CONFLICT_REVIEW' : 'INFEASIBLE',
                violations: review ? [] : [issue],
                solver: review ? {conflictEvidence: [issue]} : {},
            },
            ...(review ? {conflictReview: {token: 'test', expiresAt: '2026-11-01T00:00:00Z', violations: []}} : {}),
        } as TAutofillResponse;
    }
    it.each(['ko', 'ja', 'en'])('explains counts and preserves explicit review in %s', async (locale) => {
        const previous = i18n.language;
        try {
            await i18n.changeLanguage(locale);
            const failure = aiExecutionFailure(response(true));
            expect(failure?.message).toContain('204');
            expect(failure?.message).toContain('180');
            expect(failure?.message).toContain('24');
            expect(failure?.message).not.toContain('aiAdjust.');
            expect(failure?.recovery).toBe('review');
            expect(failure?.confirmationRequired).toBe(true);
            if (locale === 'ja') expect(failure?.message).toContain('検証済み');
        } finally {
            await i18n.changeLanguage(previous);
        }
    });
    it('still offers request/settings revision without a verified proposal', () => {
        expect(aiExecutionFailure(response())?.recovery).toBe('revise');
        expect(aiExecutionFailure(response())?.conditionConflict).toBe(true);
    });
    it('does not present inconsistent arithmetic as a proven conflict', () => {
        const value = response();
        value.engineResult!.violations = [{...issue, excessAssignments: 25}];
        expect(aiExecutionFailure(value)?.message).not.toContain('204');
    });
});

describe('combined conflict evidence', () => {
    it.each(['ko', 'ja', 'en'])('shows all proven conflicts before consent in %s', async (locale) => {
        const previous = i18n.language;
        try {
            await i18n.changeLanguage(locale);
            const result = aiExecutionFailure({
                engineResult: {
                    status: 'CONFLICT_REVIEW',
                    solver: {
                        conflictEvidence: [
                            {
                                type: 'WORK_REST_AVAILABILITY_CONFLICT',
                                nurseName: 'A',
                                forcedWorkDays: 19,
                                maximum: 5,
                                startDate: '2026-11-01',
                                endDate: '2026-11-19',
                            },
                            {type: 'MONTHLY_ASSIGNMENT_CAPACITY_CONFLICT', nurseName: 'A', minimumAssignments: 28, maximumAssignments: 21},
                            {
                                type: 'MONTHLY_STAFFING_CAPACITY_CONFLICT',
                                shiftCodes: ['D', 'E'],
                                minimumAssignments: 213,
                                maximumAssignments: 180,
                                excessAssignments: 33,
                            },
                        ],
                    },
                },
                conflictReview: {token: 'verified', expiresAt: '2026-11-01T00:00:00Z', violations: []},
            } as unknown as TAutofillResponse);
            for (const value of ['19', '5', '28', '21', '213', '180', '33', '2026-11-01']) expect(result?.message).toContain(value);
            expect(result?.confirmationRequired).toBe(true);
            expect(result?.recovery).toBe('review');
            expect(result?.message).not.toContain('aiAdjust.');
            if (locale === 'ja') expect(result?.message).not.toMatch(/[가-힣]/);
        } finally {
            await i18n.changeLanguage(previous);
        }
    });
});

describe('personal rest capacity evidence', () => {
    const response = (maximum = 0) =>
        ({
            operationType: 'ADJUST',
            draftRevision: 1,
            resultType: 'PATCH',
            applicable: false,
            changedCells: [],
            unmetInstructions: [],
            sameAsPrevious: true,
            validation: {
                draftRevision: 1,
                rulesHash: 'qa',
                summary: {valid: false, hardCount: 2, softCount: 0, totalCount: 2},
                violations: [],
            },
            engineResult: {
                status: 'INFEASIBLE',
                violations: [
                    {
                        type: 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT',
                        nurseName: 'QA nurse',
                        shiftCodes: ['O'],
                        expected: 9,
                        minimumAssignments: 0,
                        maximumAssignments: maximum,
                        title: 'internal text',
                    },
                    {
                        type: 'PERSONAL_MONTHLY_REST_CAPACITY_CONFLICT',
                        nurseName: 'QA nurse',
                        shiftCodes: ['A'],
                        expected: 2,
                        minimumAssignments: 0,
                        maximumAssignments: maximum,
                    },
                ],
            },
        }) as TAutofillResponse;
    it.each(['ko', 'ja', 'en'])('shows both conflicts and a next action in %s', async (locale) => {
        const previous = i18n.language;
        try {
            await i18n.changeLanguage(locale);
            const failure = aiExecutionFailure(response());
            expect(failure?.message).toContain(
                i18n.t('aiAdjust.executionFailure.personalRestEvidence', {
                    name: 'QA nurse',
                    shifts: 'O',
                    target: 9,
                    minimum: 0,
                    maximum: 0,
                }),
            );
            expect(failure?.message).toContain(
                i18n.t('aiAdjust.executionFailure.personalRestEvidence', {
                    name: 'QA nurse',
                    shifts: 'A',
                    target: 2,
                    minimum: 0,
                    maximum: 0,
                }),
            );
            expect(failure?.message).not.toContain('internal text');
            expect(failure?.recovery).toBe('revise');
            expect(failure?.conditionConflict).toBe(true);
            expect(failure?.confirmationRequired).not.toBe(true);
        } finally {
            await i18n.changeLanguage(previous);
        }
    });
    it('does not assert conflict when the targets fit', () => {
        expect(aiExecutionFailure(response(10))?.conditionConflict).not.toBe(true);
    });
});
