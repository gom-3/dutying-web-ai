import {describe, expect, it} from 'vitest';
import {mergePreviousShiftContext} from '../previous-shift-context';
import {writeDutyCell} from '../duty-doc-cells';
import {pastePayload} from '../clipboard';
import type {TDutyDoc} from '../types';

function doc(lastCells: (string | null)[], locks?: boolean[]): TDutyDoc {
    return {
        columns: ['2026-11-01'],
        rows: [{workerId: '11', cells: ['E'], lastCells, lastCellLocks: locks}],
        workerMeta: {11: {name: 'A', nurseId: 1}},
        fixedCells: {'11|2026-11-01': true},
        requestCells: {},
    };
}

describe('confirmed previous-month context', () => {
    it('aligns older short context to the month end rather than shifting it to the first date', () => {
        const merged = mergePreviousShiftContext(doc(['N']), doc([null, null, null, null]));
        expect(merged.rows[0].lastCells).toEqual([null, null, null, 'N']);
    });
    it('replaces persisted blanks and old values without touching current-month assignments', () => {
        const local = doc([null, 'E', null, 'E']);
        const merged = mergePreviousShiftContext(local, doc(['D', 'N', null, 'O'], [true, true, false, true]));
        expect(merged.rows[0].lastCells).toEqual(['D', 'N', null, 'O']);
        expect(merged.rows[0].cells).toBe(local.rows[0].cells);
        expect(merged.fixedCells).toBe(local.fixedCells);
        expect(merged.workerMeta).toBe(local.workerMeta);
        expect(mergePreviousShiftContext(merged, doc(['D', 'N', null, 'O'], [true, true, false, true]))).toBe(merged);
    });

    it('preserves manual input only on dates without a confirmed assignment', () => {
        const merged = mergePreviousShiftContext(doc(['E', 'N', 'D', 'O']), doc(['D', null, null, null], [true, false, false, false]));
        expect(merged.rows[0].lastCells).toEqual(['D', 'N', 'D', 'O']);
    });

    it('does not retain an old automatic value removed by reconfirmation', () => {
        const merged = mergePreviousShiftContext(doc(['D', 'N'], [true, false]), doc([null, null], [false, false]));
        expect(merged.rows[0].lastCells).toEqual([null, 'N']);
    });

    it('prevents operations and paste from overwriting confirmed cells but allows missing dates', () => {
        const current = doc(['D', null], [true, false]);
        expect(writeDutyCell(current.rows[0], -2, 'E')).toBe(current.rows[0]);
        expect(writeDutyCell(current.rows[0], -1, 'N').lastCells).toEqual(['D', 'N']);
        expect(
            pastePayload({height: 1, width: 2, cells: [['E', 'N']]}, {type: 'single', anchor: {row: 0, col: -2}}, current).cells,
        ).toEqual([{row: 0, col: -1, prev: null, next: 'N'}]);
    });
});
