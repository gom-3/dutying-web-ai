import type {TDutyDoc, TOperation, TReorderRowsOp, TSetCellsOp} from './types';

export function invertSetCellsOp(op: TSetCellsOp): TSetCellsOp {
    return {
        kind: 'setCells',
        cells: op.cells.map((cell) => ({
            row: cell.row,
            col: cell.col,
            prev: cell.next,
            next: cell.prev,
        })),
    };
}

export function invertReorderRowsOp(op: TReorderRowsOp): TReorderRowsOp {
    return {
        kind: 'reorderRows',
        prevOrder: op.nextOrder,
        nextOrder: op.prevOrder,
    };
}

export function invertOperation(op: TOperation): TOperation {
    switch (op.kind) {
        case 'setCells':
            return invertSetCellsOp(op);
        case 'reorderRows':
            return invertReorderRowsOp(op);
    }
}

function applySetCellsOp(doc: TDutyDoc, op: TSetCellsOp): TDutyDoc {
    if (op.cells.length === 0) return doc;

    // 필요한 row만 얕은 복사 (cells는 row마다 복사)
    const nextRows = doc.rows.slice();
    const touchedRows = new Set<number>();

    for (const {row} of op.cells) touchedRows.add(row);

    for (const rowIdx of touchedRows) {
        const row = nextRows[rowIdx];

        if (!row) continue;

        nextRows[rowIdx] = {...row, cells: row.cells.slice()};
    }

    for (const {row, col, next} of op.cells) {
        const r = nextRows[row];

        if (!r) continue;

        if (col < 0 || col >= r.cells.length) continue;

        r.cells[col] = next;
    }

    return {...doc, rows: nextRows};
}

function applyReorderRowsOp(doc: TDutyDoc, op: TReorderRowsOp): TDutyDoc {
    if (op.nextOrder.length !== doc.rows.length) return doc;

    const nextRows = op.nextOrder.map((idx) => doc.rows[idx]).filter(Boolean);

    if (nextRows.length !== doc.rows.length) return doc;

    return {...doc, rows: nextRows};
}

export function applyOperation(doc: TDutyDoc, op: TOperation): TDutyDoc {
    switch (op.kind) {
        case 'setCells':
            return applySetCellsOp(doc, op);
        case 'reorderRows':
            return applyReorderRowsOp(doc, op);
    }
}
