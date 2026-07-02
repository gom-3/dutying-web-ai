import type {TDutyDoc} from '@/features/shift-editor/model';
import {describe, expect, it} from 'vitest';
import {maskDutyDocCells, maskDutyDocFixedCells} from '../mask-duty-doc-non-fixed';

describe('maskDutyDocFixedCells', () => {
    it('hides fixed cells while keeping requested and editable assignments visible', () => {
        const doc: TDutyDoc = {
            columns: ['2026-07-01', '2026-07-02', '2026-07-03'],
            rows: [
                {
                    workerId: '10',
                    cells: ['D', 'E', 'N'],
                },
            ],
            workerMeta: {'10': {name: 'Kim'}},
            fixedCells: {'10|2026-07-01': true},
            requestCells: {'10|2026-07-02': true},
        };

        expect(maskDutyDocFixedCells(doc).rows[0]?.cells).toEqual([null, 'E', 'N']);
    });

    it('hides requested shift display flags while keeping assigned cells visible', () => {
        const doc: TDutyDoc = {
            columns: ['2026-07-01', '2026-07-02'],
            rows: [
                {
                    workerId: '10',
                    cells: ['D', 'E'],
                },
            ],
            workerMeta: {'10': {name: 'Kim'}},
            fixedCells: {},
            requestCells: {'10|2026-07-02': true},
        };

        const masked = maskDutyDocCells(doc, {hideRequests: true});

        expect(masked.rows[0]?.cells).toEqual(['D', 'E']);
        expect(masked.requestCells).toEqual({});
    });
});
