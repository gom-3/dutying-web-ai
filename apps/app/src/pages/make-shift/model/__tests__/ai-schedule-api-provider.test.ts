import {describe, expect, it, vi} from 'vitest';
import {apiAiScheduleProvider} from '../ai-schedule-api-provider';

const {generateAiAutofillSchedule} = vi.hoisted(() => ({
    generateAiAutofillSchedule: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        generateAiAutofillSchedule,
    },
}));

describe('apiAiScheduleProvider', () => {
    it('converts editor doc into the API payload and forwards the response', async () => {
        const response = {
            generation_id: 1,
            schedule: {1: ['D', ''], 2: ['N', 'O']},
            validation: {
                valid: true,
                hard_constraints_violated: [],
                soft_constraints_violated: [],
                warnings: [],
            },
            metrics: {
                night_shift_counts: {},
                weekend_shift_counts: {},
                fairness_score: 0,
                satisfaction_estimate: 0,
                constraint_violations: 0,
                revision_estimate: 0,
            },
            explainable_reasons: [],
            status: 'GENERATED',
            llm_model: 'gpt',
            generation_time_ms: 100,
            created_at: '2026-03-21T00:00:00.000Z',
        };

        generateAiAutofillSchedule.mockResolvedValue(response);

        const result = await apiAiScheduleProvider.generate({
            wardId: 10,
            shiftTeamId: 20,
            year: 2026,
            month: 3,
            doc: {
                columns: ['2026-03-01', '2026-03-02'],
                rows: [
                    {workerId: '1', cells: ['D', null]},
                    {workerId: '2', cells: ['N', 'O']},
                ],
                workerMeta: {
                    1: {name: 'Kim'},
                    2: {name: 'Lee'},
                },
            },
        });

        expect(generateAiAutofillSchedule).toHaveBeenCalledWith(10, 20, {
            year: 2026,
            month: 3,
            schedule: {
                1: ['D', ''],
                2: ['N', 'O'],
            },
        });
        expect(result).toEqual(response);
    });
});
