import type {TDutyDoc, TCellValue} from '@/features/shift-editor';

function isBlankLastShiftCell(cell: TCellValue | undefined): boolean {
    return cell == null || (typeof cell === 'string' && cell.trim() === '');
}

export function hasBlankLastShiftCells(doc: Pick<TDutyDoc, 'rows'>): boolean {
    return doc.rows.some((row) => row.lastCells?.some(isBlankLastShiftCell) ?? false);
}

export function findFirstBlankLastShiftCell(doc: Pick<TDutyDoc, 'rows'>): {row: number; col: number} | null {
    for (let rowIndex = 0; rowIndex < doc.rows.length; rowIndex += 1) {
        const lastCells = doc.rows[rowIndex]?.lastCells;

        if (!lastCells) continue;

        const blankIndex = lastCells.findIndex(isBlankLastShiftCell);

        if (blankIndex >= 0) return {row: rowIndex, col: blankIndex - lastCells.length};
    }

    return null;
}

export function getBlankLastShiftCellsWarningKey(doc: Pick<TDutyDoc, 'rows'>): string | null {
    const rowsWithBlankLastShifts = doc.rows
        .map((row) => {
            const lastCells = row.lastCells ?? [];

            if (!lastCells.some(isBlankLastShiftCell)) return null;

            return [row.workerId, lastCells.map((cell) => cell ?? null)] as const;
        })
        .filter((row): row is readonly [string, TCellValue[]] => row !== null);

    return rowsWithBlankLastShifts.length > 0 ? JSON.stringify(rowsWithBlankLastShifts) : null;
}
