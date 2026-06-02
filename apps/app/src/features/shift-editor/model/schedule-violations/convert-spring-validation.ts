import type {TScheduleViolationDto, TValidationRes} from '@dutying/api/ward';
import type {TCellPos, TDutyDoc, TViolation} from '../types';

function findRowIndexByShiftNurseId(doc: TDutyDoc, shiftNurseId: number): number | null {
    const workerId = String(shiftNurseId);

    for (let row = 0; row < doc.rows.length; row += 1) {
        if (doc.rows[row]?.workerId === workerId) return row;
    }

    return null;
}

function findColIndexByDate(doc: TDutyDoc, date: string): number | null {
    const col = doc.columns.indexOf(date);

    return col >= 0 ? col : null;
}

function affectedCellsToPositions(doc: TDutyDoc, affectedCells: TScheduleViolationDto['affectedCells']): TCellPos[] {
    const cells: TCellPos[] = [];
    const seen = new Set<string>();

    for (const cell of affectedCells) {
        const row = findRowIndexByShiftNurseId(doc, cell.shiftNurseId);
        const col = findColIndexByDate(doc, cell.date);

        if (row === null || col === null) continue;

        const key = `${row}:${col}`;

        if (seen.has(key)) continue;

        seen.add(key);
        cells.push({row, col});
    }

    return cells;
}

function toViolation(item: TScheduleViolationDto, doc: TDutyDoc): TViolation | null {
    const cells = affectedCellsToPositions(doc, item.affectedCells);

    if (cells.length === 0) return null;

    const level: TViolation['level'] = item.severity === 'HARD' ? 'error' : 'warning';
    const uniqueNurses = new Set(item.affectedCells.map((c) => c.shiftNurseId));
    const scope: TViolation['scope'] = uniqueNurses.size > 1 ? 'team' : 'nurse';

    return {
        ruleId: String(item.ruleId),
        violationId: item.violationId,
        message: item.message,
        level,
        cells,
        scope,
        fixable: item.fixable,
    };
}

/** Spring ValidationRes → 캘린더 표시용 TViolation[] */
export function violationsFromSpringValidation(validation: TValidationRes, doc: TDutyDoc): TViolation[] {
    return validation.violations.flatMap((item) => {
        const violation = toViolation(item, doc);

        return violation ? [violation] : [];
    });
}
