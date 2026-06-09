import {describe, expect, it} from 'vitest';
import type {TDutyDoc, TCellValue} from '@/features/shift-editor';
import {hasBlankLastShiftCells} from '../last-shift-warning';

function makeDoc(lastCells: TCellValue[] | undefined): Pick<TDutyDoc, 'rows'> {
    return {
        rows: [
            {
                workerId: '1',
                lastCells,
                cells: ['D'],
            },
        ],
    };
}

describe('hasBlankLastShiftCells', () => {
    it('returns true when any previous-shift cell is empty', () => {
        expect(hasBlankLastShiftCells(makeDoc(['D', null, 'N', 'O']))).toBe(true);
        expect(hasBlankLastShiftCells(makeDoc(['D', '', 'N', 'O']))).toBe(true);
    });

    it('returns false when previous-shift cells are fully entered', () => {
        expect(hasBlankLastShiftCells(makeDoc(['D', 'E', 'N', 'O']))).toBe(false);
    });

    it('ignores rows without previous-shift cells', () => {
        expect(hasBlankLastShiftCells(makeDoc(undefined))).toBe(false);
    });
});
