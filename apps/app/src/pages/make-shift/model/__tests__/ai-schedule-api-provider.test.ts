import {describe, expect, it, vi} from 'vitest';
import {apiAiScheduleProvider} from '../ai-schedule-api-provider';

const {autofillSchedule} = vi.hoisted(() => ({autofillSchedule: vi.fn()}));

vi.mock('@/shared/api/ward', () => ({
    default: {autofillSchedule},
}));

describe('apiAiScheduleProvider', () => {
    it('calls Spring /schedule/autofill with normalized draft payload', async () => {
        const response = {
            operationType: 'GENERATE',
            draftRevision: 3,
            resultType: 'PATCH',
            changedCells: [
                {
                    cellKey: '501:2026-06-02',
                    shiftNurseId: 501,
                    date: '2026-06-02',
                    wardShiftTypeId: 104,
                    shiftCode: 'O',
                    source: 'AI',
                    fixed: false,
                },
            ],
            validation: {
                draftRevision: 3,
                rulesHash: 'sha256:rules-v1',
                summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                violations: [],
            },
            unmetInstructions: [],
            sameAsPrevious: false,
        };

        autofillSchedule.mockResolvedValue(response);

        const doc = {
            columns: ['2026-06-01', '2026-06-02'],
            rows: [
                {workerId: '501', cells: ['D', null]},
                {workerId: '502', cells: ['N', 'O']},
            ],
            workerMeta: {
                501: {name: 'Kim', nurseId: 301, priority: 1024, divisionNum: 1},
                502: {name: 'Lee', nurseId: 302, priority: 2048, divisionNum: 1},
            },
            fixedCells: {},
            requestCells: {},
        };

        const originalShift = {
            days: [{day: 1}, {day: 2}],
            wardShiftTypes: [
                {wardShiftTypeId: 101, shortName: 'D'},
                {wardShiftTypeId: 102, shortName: 'N'},
                {wardShiftTypeId: 103, shortName: 'O'},
            ],
            divisionShiftNurses: [],
        } as never;

        const result = await apiAiScheduleProvider.generate({
            wardId: 1,
            shiftTeamId: 10,
            year: 2026,
            month: 6,
            doc,
            originalShift,
            draftRevision: 3,
            rulesHash: 'sha256:rules-v1',
            prompt: '야간 줄여줘',
        });

        expect(autofillSchedule).toHaveBeenCalledWith(
            1,
            10,
            expect.objectContaining({
                year: 2026,
                month: 6,
                draftRevision: 3,
                rulesHash: 'sha256:rules-v1',
                prompt: '야간 줄여줘',
                returnMode: 'PATCH',
                rowOrder: [
                    expect.objectContaining({shiftNurseId: 501, displayOrder: 1, nurseId: 301}),
                    expect.objectContaining({shiftNurseId: 502, displayOrder: 2, nurseId: 302}),
                ],
                lockedCellKeys: [],
                cells: [
                    expect.objectContaining({
                        cellKey: '501:2026-06-01',
                        shiftNurseId: 501,
                        nurseId: 301,
                        date: '2026-06-01',
                        wardShiftTypeId: 101,
                        shiftCode: 'D',
                        source: 'DRAFT',
                        fixed: false,
                    }),
                    expect.objectContaining({
                        cellKey: '501:2026-06-02',
                        shiftNurseId: 501,
                        nurseId: 301,
                        date: '2026-06-02',
                        wardShiftTypeId: null,
                        shiftCode: undefined,
                        source: 'EMPTY',
                        fixed: false,
                    }),
                    expect.objectContaining({
                        cellKey: '502:2026-06-01',
                        shiftNurseId: 502,
                        nurseId: 302,
                        date: '2026-06-01',
                        wardShiftTypeId: 102,
                        shiftCode: 'N',
                        source: 'DRAFT',
                        fixed: false,
                    }),
                    expect.objectContaining({
                        cellKey: '502:2026-06-02',
                        shiftNurseId: 502,
                        nurseId: 302,
                        date: '2026-06-02',
                        wardShiftTypeId: 103,
                        shiftCode: 'O',
                        source: 'DRAFT',
                        fixed: false,
                    }),
                ],
            }),
        );
        expect(result).toEqual(response);
    });
});
