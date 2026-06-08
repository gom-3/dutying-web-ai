import type {TCellValue, TDutyDoc, TDutyRow} from './types';

export function getLastShiftCellCount(doc: TDutyDoc): number {
    return doc.rows.reduce((max, row) => Math.max(max, row.lastCells?.length ?? 0), 0);
}

export function getDutyDocMinColumn(doc: TDutyDoc): number {
    return -getLastShiftCellCount(doc);
}

function getLastCellIndex(row: TDutyRow, colIndex: number): number | null {
    if (colIndex >= 0) return null;

    const lastCells = row.lastCells ?? [];
    const index = lastCells.length + colIndex;

    return index >= 0 && index < lastCells.length ? index : null;
}

export function isDutyCellPositionInBounds(doc: TDutyDoc, rowIndex: number, colIndex: number): boolean {
    const row = doc.rows[rowIndex];

    if (!row) return false;

    if (colIndex >= 0) return colIndex < doc.columns.length;

    return getLastCellIndex(row, colIndex) !== null;
}

export function getDutyCellLockKey(doc: TDutyDoc, rowIndex: number, colIndex: number): string | null {
    if (colIndex < 0) return null;

    const row = doc.rows[rowIndex];
    const date = doc.columns[colIndex];

    if (!row || !date) return null;

    return `${row.workerId}|${date}`;
}

export function readDutyCell(row: TDutyRow, colIndex: number): TCellValue {
    if (colIndex < 0) {
        const index = getLastCellIndex(row, colIndex);

        return index === null ? null : (row.lastCells?.[index] ?? null);
    }

    return row.cells[colIndex] ?? null;
}

export function writeDutyCell(row: TDutyRow, colIndex: number, value: TCellValue): TDutyRow {
    if (colIndex < 0) {
        const index = getLastCellIndex(row, colIndex);

        if (index === null) return row;

        const nextLastCells = (row.lastCells ?? []).slice();
        nextLastCells[index] = value;

        return {...row, lastCells: nextLastCells};
    }

    if (colIndex >= row.cells.length) return row;

    const nextCells = row.cells.slice();
    nextCells[colIndex] = value;

    return {...row, cells: nextCells};
}
