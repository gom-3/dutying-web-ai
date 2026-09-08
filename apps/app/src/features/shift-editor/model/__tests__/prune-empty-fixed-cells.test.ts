import {describe, expect, it} from 'vitest';
import {pruneEmptyFixedCells} from '../prune-empty-fixed-cells';
import type {TDutyDoc} from '../types';

function doc(overrides: Partial<TDutyDoc> = {}): TDutyDoc {
    return {
        columns: ['2026-09-01', '2026-09-02'],
        rows: [
            {workerId: '21176', cells: ['D', null]},
            {workerId: '21178', cells: [null, 'E']},
        ],
        workerMeta: {},
        fixedCells: {},
        requestCells: {},
        ...overrides,
    };
}

describe('pruneEmptyFixedCells', () => {
    it('근무가 없는 칸의 고정을 떼고 값이 있는 고정은 남긴다', () => {
        const next = pruneEmptyFixedCells(
            doc({fixedCells: {'21176|2026-09-01': true, '21176|2026-09-02': true, '21178|2026-09-02': true}}),
        );

        expect(next.fixedCells).toEqual({'21176|2026-09-01': true, '21178|2026-09-02': true});
    });

    it('doc 에 없는 행·날짜의 잠금은 건드리지 않는다', () => {
        const fixedCells: TDutyDoc['fixedCells'] = {'99999|2026-09-01': true, '21176|2026-12-25': true};
        const next = pruneEmptyFixedCells(doc({fixedCells}));

        expect(next.fixedCells).toEqual(fixedCells);
    });

    it('뗄 것이 없으면 같은 객체를 그대로 돌려준다', () => {
        const filled = doc({fixedCells: {'21176|2026-09-01': true}});
        const empty = doc();

        expect(pruneEmptyFixedCells(filled)).toBe(filled);
        expect(pruneEmptyFixedCells(empty)).toBe(empty);
    });

    it('신청근무 잠금은 손대지 않는다', () => {
        const next = pruneEmptyFixedCells(doc({fixedCells: {'21176|2026-09-02': true}, requestCells: {'21176|2026-09-02': true}}));

        expect(next.fixedCells).toEqual({});
        expect(next.requestCells).toEqual({'21176|2026-09-02': true});
    });
});
