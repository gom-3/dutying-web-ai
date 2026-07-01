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

    it('returns the provider error message for retry UX', async () => {
        apiGenerate.mockRejectedValue(new Error('AI 생성 실패'));

        const result = await requestAiSchedule(request);

        expect(result).toEqual({ok: false, message: 'AI 생성 실패'});
    });

    it('marks aborted requests as canceled', async () => {
        const abortController = new AbortController();

        abortController.abort();
        apiGenerate.mockRejectedValue(new Error('canceled'));

        const result = await requestAiSchedule({...request, signal: abortController.signal});

        expect(result).toEqual({ok: false, message: '', canceled: true});
    });

    it('returns the first unmet instruction when the server applies no AI changes', async () => {
        apiGenerate.mockResolvedValue({
            ...response,
            changedCells: [],
            unmetInstructions: ['AI 근무표 엔진 호출에 실패했습니다. 잠시 후 다시 시도해주세요.'],
            sameAsPrevious: true,
        });

        const result = await requestAiSchedule(request);

        expect(result).toEqual({
            ok: false,
            message: 'AI 근무표 엔진 호출에 실패했습니다. 잠시 후 다시 시도해주세요.',
        });
    });
});
