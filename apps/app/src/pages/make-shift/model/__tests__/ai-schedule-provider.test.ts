import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TAiScheduleRequest} from '../ai-schedule-contract';
import {requestAiSchedule} from '../ai-schedule-provider';

const {apiGenerate, mockGenerate} = vi.hoisted(() => ({
    apiGenerate: vi.fn(),
    mockGenerate: vi.fn(),
}));

vi.mock('../ai-schedule-api-provider', () => ({
    apiAiScheduleProvider: {
        generate: apiGenerate,
    },
}));

vi.mock('../ai-schedule-mock', () => ({
    mockAiScheduleProvider: {
        generate: mockGenerate,
    },
}));

const request: TAiScheduleRequest = {
    wardId: 1,
    shiftTeamId: 2,
    year: 2026,
    month: 3,
    doc: {
        columns: ['2026-03-01'],
        rows: [{workerId: '1', cells: ['D']}],
        workerMeta: {1: {name: '간호사 1'}},
        fixedCells: {},
        requestCells: {},
    },
    originalShift: {days: [], wardShiftTypes: [], divisionShiftNurses: []} as never,
    draftRevision: 1,
    rulesHash: 'sha256:test',
};
const response = {
    operationType: 'GENERATE',
    draftRevision: 1,
    resultType: 'PATCH',
    changedCells: [],
    validation: {
        draftRevision: 1,
        rulesHash: 'sha256:test',
        summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
        violations: [],
    },
    unmetInstructions: [],
    sameAsPrevious: false,
} as const;

describe('requestAiSchedule', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        apiGenerate.mockReset();
        mockGenerate.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('uses api provider by default', async () => {
        apiGenerate.mockResolvedValue(response);

        const result = await requestAiSchedule(request);

        expect(apiGenerate).toHaveBeenCalledWith(request);
        expect(mockGenerate).not.toHaveBeenCalled();
        expect(result).toEqual({ok: true, response, validation: response.validation});
    });

    it('uses mock provider only when feature flag is explicitly set', async () => {
        vi.stubEnv('VITE_AI_SCHEDULE_PROVIDER', 'mock');
        mockGenerate.mockResolvedValue(response);

        const result = await requestAiSchedule(request);

        expect(mockGenerate).toHaveBeenCalledWith(request);
        expect(apiGenerate).not.toHaveBeenCalled();
        expect(result).toEqual({ok: true, response, validation: response.validation});
    });

    it('replaces arbitrary provider errors with a user-facing retry message', async () => {
        apiGenerate.mockRejectedValue(new Error('AI 생성 실패'));

        const result = await requestAiSchedule(request);

        expect(result).toMatchObject({ok: false, failure: {blocked: false}});
        expect(!result.ok && result.message).not.toBe('AI 생성 실패');
    });

    it.each([
        ['INFEASIBLE', 'HARD_RULE_CONFLICT', 'revise'],
        ['REJECTED', 'solver_result_failed_final_gate', 'revise'],
        ['REJECTED', 'solver_result_validation_unavailable', 'retry'],
        ['REJECTED', 'solver_result_incomplete', 'retry'],
        ['REJECTED', 'contract_locked_empty_cell', 'review'],
        ['REJECTED', 'unsupported_hard_rule', 'revise'],
        ['ACCEPTED', 'SPRING_HARD_VALIDATION', 'revise'],
        ['REJECTED', 'unrecognized_reason', 'retry'],
    ])('does not apply a candidate rejected by %s / %s and gives a relevant next step', async (status, reason, recovery) => {
        for (const operationType of ['GENERATE', 'ADJUST'] as const) {
            apiGenerate.mockResolvedValue({
                ...response,
                operationType,
                applicable: false,
                changedCells: [{shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 2}],
                unmetInstructions: ['승인 조건을 충족하지 못한 근무표 후보를 검토용으로 반환합니다.'],
                engineResult: {status, solver: {reason}},
            });

            const result = await requestAiSchedule({
                ...request,
                ...(operationType === 'ADJUST' ? {adjust: {strength: 'NORMAL' as const}} : {}),
            });

            expect(result).toMatchObject({ok: false, failure: {recovery, blocked: false}});
            expect(!result.ok && result.message).not.toMatch(/검토용|승인 조건|unrecognized_reason/);
            expect(!result.ok && result.message).toContain('기존 근무표는 그대로예요.');
        }
    });

    it.each(['REJECTED', 'ACCEPTED'])('applies a verified GENERATE review draft with %s while approval stays blocked', async (status) => {
        const review = {
            ...response,
            applicable: true,
            approvable: false,
            validationTarget: 'RESULT',
            changedCells: [{shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 2}],
            validation: {...response.validation, summary: {...response.validation.summary, valid: false, hardCount: 1}},
            unmetInstructions: ['초안을 만들었어요. 기존 고정표에 D가 부족해요.'],
            engineResult: {status, candidateVisible: true, reviewRequired: true},
        };

        apiGenerate.mockResolvedValue(review);

        const result = await requestAiSchedule(request);

        expect(result).toMatchObject({ok: true, response: {approvable: false, changedCells: review.changedCells}});

        apiGenerate.mockResolvedValue({...review, operationType: 'ADJUST'});

        const adjustResult = await requestAiSchedule({...request, adjust: {strength: 'NORMAL'}});

        expect(adjustResult.ok).toBe(false);
    });

    it.each([undefined, false])('keeps rejected drafts blocked without explicit reviewRequired=%s', async (reviewRequired) => {
        apiGenerate.mockResolvedValue({
            ...response,
            applicable: true,
            validationTarget: 'RESULT',
            changedCells: [{shiftNurseId: 1, date: '2026-03-01', wardShiftTypeId: 2}],
            engineResult: {status: 'REJECTED', candidateVisible: true, reviewRequired},
        });
        expect((await requestAiSchedule(request)).ok).toBe(false);
    });

    it.each(['AI_QUOTA_EXCEEDED', 'AI_QUOTA_EXHAUSTED'])('keeps %s separate from draft conflicts', async (serverCode) => {
        apiGenerate.mockRejectedValue(Object.assign(new Error('quota'), {code: 409, serverCode}));

        const result = await requestAiSchedule(request);

        expect(result).toMatchObject({ok: false, failure: {blocked: true}});
        expect(result).not.toHaveProperty('conflict');
        expect(!result.ok && result.message).not.toBe('quota');
    });

    it('preserves the server wait time for usage limits', async () => {
        apiGenerate.mockRejectedValue(
            Object.assign(new Error('약 25분 후 다시 시도해 주세요.'), {
                code: 429,
                serverCode: 'SCHEDULE_AUTOFILL_RATE_LIMIT_EXCEEDED',
            }),
        );
        expect(await requestAiSchedule(request)).toMatchObject({
            ok: false,
            message: '약 25분 후 다시 시도해 주세요.',
            failure: {blocked: true},
        });
    });

    it('marks aborted requests as canceled', async () => {
        const abortController = new AbortController();

        abortController.abort();
        apiGenerate.mockRejectedValue(new Error('canceled'));

        const result = await requestAiSchedule({...request, signal: abortController.signal});

        expect(result).toEqual({ok: false, message: '', canceled: true});
    });

    it('does not show an internal engine instruction when no AI changes were applied', async () => {
        apiGenerate.mockResolvedValue({
            ...response,
            changedCells: [],
            unmetInstructions: ['AI 근무표 엔진 호출에 실패했습니다. 잠시 후 다시 시도해주세요.'],
            sameAsPrevious: true,
        });

        const result = await requestAiSchedule(request);

        expect(result).toMatchObject({ok: false, failure: {recovery: 'retry'}});
        expect(!result.ok && result.message).toContain('기존 근무표는 그대로예요.');
        expect(!result.ok && result.message).not.toMatch(/엔진|호출/);
    });
});

describe('requestAiSchedule — 조절(ADJUST)', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        apiGenerate.mockReset();
        mockGenerate.mockReset();
    });

    it('바뀐 칸이 없는 조절을 실패가 아니라 성공으로 돌려준다', async () => {
        // 조절에서 changedCells 가 비었다는 것은 "이미 그 방향으로 최적"이라는 뜻이다.
        // 실패로 처리하면 사용자는 칩을 누를 때마다 빨간 토스트를 보게 된다.
        apiGenerate.mockResolvedValue({
            operationType: 'ADJUST',
            draftRevision: 3,
            resultType: 'PATCH',
            changedCells: [],
            validation: response.validation,
            unmetInstructions: ['승인 조건을 충족하지 못한 근무표 후보를 검토용으로 반환합니다.'],
            sameAsPrevious: true,
            engineResult: {status: 'ACCEPTED', solver: {reason: 'ADJUST_NO_CHANGE'}},
        });

        const result = await requestAiSchedule({
            ...request,
            adjust: {knobs: {OFF_BALANCE: 1}, strength: 'NORMAL'},
        });

        expect(result.ok).toBe(true);
        expect(result.ok && result.noChange).toBe(true);
    });

    it('서버가 사람 단위 게이트로 막은 조절은 실패가 아니라 notAllowed 로 돌려준다', async () => {
        // 잠시 후 다시 시도해도 달라지지 않으므로 "실패했어요" 토스트 대신 "아직 열리지 않았어요"로 말해야 한다.
        apiGenerate.mockRejectedValue({code: 403, serverCode: 'SCHEDULE_AUTOFILL_ADJUST_NOT_ALLOWED', message: 'forbidden'});

        const result = await requestAiSchedule({
            ...request,
            adjust: {knobs: {OFF_BALANCE: 1}, strength: 'NORMAL'},
        });

        expect(result).toMatchObject({ok: false, notAllowed: true, failure: {blocked: true}});
        expect(!result.ok && result.message).not.toBe('forbidden');
    });

    it('중단된 조절은 내부 계산 사유를 노출하지 않고 표를 보존한다', async () => {
        apiGenerate.mockResolvedValue({
            operationType: 'ADJUST',
            draftRevision: 3,
            resultType: 'PATCH',
            changedCells: [],
            validation: response.validation,
            unmetInstructions: ['전체 월 근무표를 안전하게 생성하지 못했습니다.'],
            sameAsPrevious: true,
            engineResult: {status: 'TIME_LIMIT', solver: {reason: 'time_limit_no_solution'}},
        });

        const result = await requestAiSchedule({
            ...request,
            adjust: {knobs: {OFF_BALANCE: 1}, strength: 'NORMAL'},
        });

        expect(result).toMatchObject({ok: false, failure: {blocked: false, recovery: 'retry'}});
        expect(!result.ok && result.message).toContain('근무표 작성 중 문제가 생겼어요.');
        expect(!result.ok && result.message).not.toMatch(/시간|제한|타임아웃|솔버|엔진|TIME_LIMIT/);
    });

    it('조절이 아닌 요청에서는 빈 결과가 여전히 실패다', async () => {
        apiGenerate.mockResolvedValue({
            operationType: 'GENERATE',
            draftRevision: 3,
            resultType: 'PATCH',
            changedCells: [],
            validation: response.validation,
            unmetInstructions: ['전체 월 근무표를 안전하게 생성하지 못했습니다.'],
            sameAsPrevious: true,
        });

        const result = await requestAiSchedule(request);

        expect(result.ok).toBe(false);
    });
});
