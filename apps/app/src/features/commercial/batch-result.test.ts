import {describe, expect, it} from 'vitest';
import {batchCellsForReview, type CommercialBatchResult} from './batch-result';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
const doc: TDutyDoc = {
    columns: ['2026-09-01', '2026-09-02'],
    rows: [{workerId: '1', cells: [null, null]}],
    workerMeta: {},
    fixedCells: {'1|2026-09-01': true},
    requestCells: {},
};
const batch: CommercialBatchResult = {
    requestKey: 'test',
    targets: [{shiftTeamId: 2, year: 2026, month: 9}],
    jobs: [
        {
            id: 'job',
            shiftTeamId: 2,
            status: 'SUCCEEDED',
            result: JSON.stringify({
                changedCells: [
                    {shiftNurseId: 1, date: '2026-09-01', wardShiftTypeId: 1},
                    {shiftNurseId: 1, date: '2026-09-02', wardShiftTypeId: 2},
                ],
            }),
        },
    ],
};
describe('persisted batch result review', () => {
    it('preserves protected cells and does not need another AI request', () => {
        expect(batchCellsForReview(batch, 2, 2026, 9, doc)).toEqual([{shiftNurseId: 1, date: '2026-09-02', wardShiftTypeId: 2}]);
        expect(batchCellsForReview(batch, 2, 2026, 9, {...doc, requestCells: {'1|2026-09-02': true}})).toEqual([]);
    });
    it('rejects a different team, month, removed roster or unfinished result', () => {
        expect(() => batchCellsForReview(batch, 3, 2026, 9, doc)).toThrow('BATCH_SCOPE_CHANGED');
        expect(() => batchCellsForReview(batch, 2, 2026, 10, doc)).toThrow('BATCH_SCOPE_CHANGED');
        expect(() => batchCellsForReview(batch, 2, 2026, 9, {...doc, rows: []})).toThrow('BATCH_ROSTER_CHANGED');
        expect(() => batchCellsForReview({...batch, jobs: [{...batch.jobs[0]!, status: 'UNKNOWN'}]}, 2, 2026, 9, doc)).toThrow(
            'BATCH_RESULT_UNAVAILABLE',
        );
    });
});
