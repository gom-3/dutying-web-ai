import {describe, expect, it} from 'vitest';
import {invertOp, invertOps} from './invert';
import type {EditorOp, ReorderRowsOp, SetCellsOp} from './types';

describe('editor-core/operation/invert', () => {
    it('invertOp(setCells)는 prev/next를 swap 한다', () => {
        const op: SetCellsOp = {
            kind: 'setCells',
            cells: [
                {row: 0, col: 0, prev: null, next: 'D'},
                {row: 1, col: 2, prev: 'N', next: null},
            ],
        };
        const inverted = invertOp(op);

        expect(inverted).toEqual({
            kind: 'setCells',
            cells: [
                {row: 0, col: 0, prev: 'D', next: null},
                {row: 1, col: 2, prev: null, next: 'N'},
            ],
        });
    });

    it('invertOp(reorderRows)는 prevOrder/nextOrder를 swap 한다', () => {
        const op: ReorderRowsOp = {kind: 'reorderRows', prevOrder: [0, 1, 2], nextOrder: [2, 0, 1]};
        const inverted = invertOp(op);

        expect(inverted).toEqual({kind: 'reorderRows', prevOrder: [2, 0, 1], nextOrder: [0, 1, 2]});
    });

    it('invertOps는 reverse + invert 를 수행한다', () => {
        const ops: EditorOp[] = [
            {kind: 'setCells', cells: [{row: 0, col: 0, prev: null, next: 'D'}]},
            {kind: 'reorderRows', prevOrder: [0, 1], nextOrder: [1, 0]},
        ];
        const result = invertOps(ops);

        // 역순으로 적용되어야 함
        expect(result).toEqual([
            {kind: 'reorderRows', prevOrder: [1, 0], nextOrder: [0, 1]},
            {kind: 'setCells', cells: [{row: 0, col: 0, prev: 'D', next: null}]},
        ]);
    });
});
