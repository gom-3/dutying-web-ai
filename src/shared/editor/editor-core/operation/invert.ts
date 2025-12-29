import type {EditorOp, ReorderRowsOp, SetCellsOp} from './types';

export function invertOp(op: SetCellsOp): SetCellsOp;
export function invertOp(op: ReorderRowsOp): ReorderRowsOp;
export function invertOp(op: EditorOp): EditorOp;
export function invertOp(op: EditorOp): EditorOp {
    switch (op.kind) {
        case 'setCells':
            return {
                kind: 'setCells',
                cells: op.cells.map((c) => ({
                    row: c.row,
                    col: c.col,
                    prev: c.next,
                    next: c.prev,
                })),
            };
        case 'reorderRows':
            return {
                kind: 'reorderRows',
                prevOrder: op.nextOrder,
                nextOrder: op.prevOrder,
            };
        default: {
            // Exhaustiveness check

            const _never: never = op;

            return _never;
        }
    }
}

export function invertOps(ops: EditorOp[]): EditorOp[] {
    // Inverse must be applied in reverse order.
    return [...ops].reverse().map(invertOp);
}
