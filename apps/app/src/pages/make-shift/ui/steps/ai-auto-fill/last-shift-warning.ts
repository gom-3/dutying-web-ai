import type {TDutyDoc, TCellValue} from '@/features/shift-editor';

function isBlankLastShiftCell(cell: TCellValue | undefined): boolean {
    return cell == null || (typeof cell === 'string' && cell.trim() === '');
}

export function hasBlankLastShiftCells(doc: Pick<TDutyDoc, 'rows'>): boolean {
    return doc.rows.some((row) => row.lastCells?.some(isBlankLastShiftCell) ?? false);
}
