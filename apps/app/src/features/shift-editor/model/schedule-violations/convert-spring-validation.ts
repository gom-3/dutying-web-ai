import type {TScheduleViolationDto, TValidationRes} from '@dutying/api/ward';
import type {TCellPos, TDutyDoc, TViolation} from '../types';
import {localizeScheduleValidationMessage} from './format-validation-message';

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
        const row = findRowIndexByShiftNurseId(doc, cell.shiftNurseId) ?? (doc.rows.length > 0 ? 0 : null);
        const col = findColIndexByDate(doc, cell.date);

        if (row === null || col === null) continue;

        const key = `${row}:${col}`;

        if (seen.has(key)) continue;

        seen.add(key);
        cells.push({row, col});
    }

    return cells;
}

const NURSE_PAIR_TEMPLATE_CODES = new Set(['NURSE_PAIR_NOT_SAME_SHIFT', 'NURSE_PAIR_PREFER_SAME_SHIFT']);

function resolveViolationScope(item: TScheduleViolationDto): TViolation['scope'] {
    if (item.templateCode && NURSE_PAIR_TEMPLATE_CODES.has(item.templateCode)) return 'nurse';

    const uniqueNurses = new Set(item.affectedCells.map((c) => c.shiftNurseId));

    return uniqueNurses.size > 1 ? 'team' : 'nurse';
}

function toViolation(item: TScheduleViolationDto, doc: TDutyDoc): TViolation | null {
    const cells = affectedCellsToPositions(doc, item.affectedCells);

    if (cells.length === 0) return null;

    const displayContextCells = item.displayContext?.affectedCells
        ? affectedCellsToPositions(doc, item.displayContext.affectedCells)
        : [];
    const level: TViolation['level'] = item.severity === 'HARD' ? 'error' : 'warning';
    const scope = resolveViolationScope(item);
    const violation: TViolation = {
        ruleId: String(item.ruleId),
        violationId: item.violationId,
        templateCode: item.templateCode,
        message: localizeScheduleValidationMessage(item),
        level,
        cells,
        scope,
        affectedCells: item.affectedCells,
        fixable: item.fixable,
    };

    if (item.period) {
        violation.period = item.period;
    }

    if (item.displayContext && displayContextCells.length > 0) {
        violation.displayContext = {
            cells: displayContextCells,
            affectedCells: item.displayContext.affectedCells,
        };

        if (item.displayContext.period) {
            violation.displayContext.period = item.displayContext.period;
        }
    }

    return violation;
}

/** Spring ValidationRes → 캘린더 표시용 TViolation[] */
export function violationsFromSpringValidation(validation: TValidationRes, doc: TDutyDoc): TViolation[] {
    return validation.violations.flatMap((item) => {
        const violation = toViolation(item, doc);

        return violation ? [violation] : [];
    });
}
