import {describe, expect, it} from 'vitest';
import {adjustLockedCellKeys} from '../schedule-authoring';
import type {TDutyDoc} from '../types';

/**
 * 조절이 건드리면 안 되는 셀.
 *
 * 사용자가 자동완성 뒤에 손으로 고친 칸은 칩보다 강한 신호다. 그것까지 조절이 다시 옮기면
 * 방금 맞춰 놓은 것이 눈앞에서 사라진다.
 */
describe('adjustLockedCellKeys', () => {
    const doc: TDutyDoc = {
        columns: ['2026-06-01', '2026-06-02'],
        rows: [
            {workerId: '501', cells: ['D', 'O']},
            {workerId: '502', cells: ['N', 'O']},
        ],
        workerMeta: {},
        fixedCells: {'501|2026-06-01': true},
        requestCells: {'502|2026-06-02': true},
    } as unknown as TDutyDoc;

    it('keeps fixed and requested cells locked', () => {
        expect(adjustLockedCellKeys(doc, [])).toEqual(expect.arrayContaining(['501:2026-06-01', '502:2026-06-02']));
    });

    it('also locks cells the user edited after the last autofill', () => {
        const keys = adjustLockedCellKeys(doc, [{row: 1, col: 0}]);

        expect(keys).toContain('502:2026-06-01');
    });

    it('does not duplicate a cell that is both fixed and edited', () => {
        const keys = adjustLockedCellKeys(doc, [{row: 0, col: 0}]);

        expect(keys.filter((key) => key === '501:2026-06-01')).toHaveLength(1);
    });

    it('ignores positions that fall outside the doc', () => {
        expect(() => adjustLockedCellKeys(doc, [{row: 9, col: 9}])).not.toThrow();
        expect(adjustLockedCellKeys(doc, [{row: 9, col: 9}])).toHaveLength(2);
    });
});
