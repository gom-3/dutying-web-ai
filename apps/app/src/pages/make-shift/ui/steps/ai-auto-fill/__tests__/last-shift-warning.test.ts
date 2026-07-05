import {describe, expect, it} from 'vitest';
import type {TDutyDoc, TCellValue} from '@/features/shift-editor';
import {findFirstBlankLastShiftCell, getBlankLastShiftCellsWarningKey, hasBlankLastShiftCells} from '../last-shift-warning';

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

describe('getBlankLastShiftCellsWarningKey', () => {
    it('returns null when previous-shift cells are fully entered', () => {
        expect(getBlankLastShiftCellsWarningKey(makeDoc(['D', 'E', 'N', 'O']))).toBeNull();
    });

    it('changes when blank previous-shift context changes', () => {
        const firstKey = getBlankLastShiftCellsWarningKey(makeDoc(['D', null, 'N', 'O']));
        const nextKey = getBlankLastShiftCellsWarningKey(makeDoc(['D', null, 'E', 'O']));

        expect(firstKey).not.toBeNull();
        expect(nextKey).not.toBeNull();
        expect(firstKey).not.toBe(nextKey);
    });
});

describe('findFirstBlankLastShiftCell', () => {
    it('returns the top-most first blank previous-shift cell using negative columns', () => {
        expect(findFirstBlankLastShiftCell(makeDoc(['D', null, 'N', 'O']))).toEqual({row: 0, col: -3});
    });

    it('returns null when there is no blank previous-shift cell', () => {
        expect(findFirstBlankLastShiftCell(makeDoc(['D', 'E', 'N', 'O']))).toBeNull();
    });
});
