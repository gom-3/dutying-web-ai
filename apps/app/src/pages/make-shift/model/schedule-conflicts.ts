import type {TScheduleConflict} from '@dutying/api/ward';
import type {TDutyDoc, TCellPos} from '@/features/shift-editor/model/types';

const validDate = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
const id = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);

/** Ignore malformed evidence instead of displaying an untrusted internal error. */
export function readScheduleConflicts(value: unknown): TScheduleConflict[] {
    if (!Array.isArray(value) || value.length > 20) return [];

    return value.filter(
        (item): item is TScheduleConflict =>
            item != null &&
            validDate(item.date) &&
            Number.isInteger(item.required) &&
            Number.isInteger(item.available) &&
            item.required > item.available &&
            item.required <= 10000 &&
            item.available >= 0 &&
            Array.isArray(item.shiftCodes) &&
            item.shiftCodes.length > 0 &&
            item.shiftCodes.length <= 6 &&
            item.shiftCodes.every(text) &&
            Array.isArray(item.ruleIds) &&
            item.ruleIds.length <= 200 &&
            item.ruleIds.every(id) &&
            Array.isArray(item.nurses) &&
            item.nurses.length > 0 &&
            item.nurses.length <= 1000 &&
            item.nurses.every(
                (n: TScheduleConflict['nurses'][number]) =>
                    n != null &&
                    id(n.shiftNurseId) &&
                    text(n.name) &&
                    ['FIXED_ASSIGNMENT', 'CONSECUTIVE_WORK_LIMIT', 'SHIFT_NOT_ALLOWED'].includes(n.reason) &&
                    (n.reason !== 'CONSECUTIVE_WORK_LIMIT' ||
                        (Number.isInteger(n.maximumWorkDays) && n.maximumWorkDays! >= 1 && n.maximumWorkDays! <= 62)),
            ) &&
            Array.isArray(item.fixedAssignments) &&
            item.fixedAssignments.length <= 5000 &&
            item.fixedAssignments.every(
                (c: TScheduleConflict['fixedAssignments'][number]) =>
                    c != null &&
                    id(c.shiftNurseId) &&
                    text(c.name) &&
                    validDate(c.date) &&
                    id(c.wardShiftTypeId) &&
                    text(c.shiftCode) &&
                    typeof c.readOnly === 'boolean',
            ),
    );
}

/** Resolve against the CURRENT table; never use a stale row index or date offset. */
export function conflictCellPosition(doc: TDutyDoc, nurseId: number, date: string, expectedCode?: string): TCellPos | null {
    const row = doc.rows.findIndex((entry) => entry.workerId === String(nurseId));
    const col = doc.columns.indexOf(date);

    if (row < 0 || col < 0 || (expectedCode !== undefined && doc.rows[row]?.cells[col] !== expectedCode)) return null;

    return {row, col};
}
