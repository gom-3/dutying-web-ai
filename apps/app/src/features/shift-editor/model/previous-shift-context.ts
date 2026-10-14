import type {TDutyDoc, TDutyRow} from './types';

/** Refresh only previous-month context; preserve current-month work and history. */
export function mergePreviousShiftRow(row: TDutyRow, base: TDutyRow): TDutyRow {
    const offset = (base.lastCells?.length ?? 0) - (row.lastCells?.length ?? 0);
    const lastCells = (base.lastCells ?? []).map((cell, index) => {
        const persistedIndex = index - offset;

        if (base.lastCellLocks?.[index] || row.lastCellLocks?.[persistedIndex]) return cell;

        const manual = row.lastCells?.[persistedIndex];

        return manual === '' ? cell : (manual ?? cell);
    });
    const lastCellLocks = base.lastCellLocks;

    if (
        lastCells.length === row.lastCells?.length &&
        lastCells.every((cell, i) => cell === row.lastCells?.[i]) &&
        lastCellLocks?.length === row.lastCellLocks?.length &&
        (lastCellLocks ?? []).every((locked, i) => locked === row.lastCellLocks?.[i])
    )
        return row;

    return {...row, lastCells, lastCellLocks};
}

export function mergePreviousShiftContext(doc: TDutyDoc, base: TDutyDoc): TDutyDoc {
    const byWorker = new Map(base.rows.map((row) => [row.workerId, row]));
    const rows = doc.rows.map((row) => {
        const baseRow = byWorker.get(row.workerId);

        return baseRow ? mergePreviousShiftRow(row, baseRow) : row;
    });

    return rows.every((row, i) => row === doc.rows[i]) ? doc : {...doc, rows};
}
