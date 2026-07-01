import type {TShift} from '@/entities';
import type {TDutyDoc} from '@/features/shift-editor/model';
import {calculateRestTarget, resolveCountedRestShiftTypeIds, type TRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';

export type TRestCheckSummary = {
    targetDays: number;
    assignedDays: number;
    carriedDays: number;
    carryOverApplied: boolean;
    differenceDays: number;
};

function countHolidayDays(days: TShift['days']) {
    return days.filter((day) => String(day.dayType).toLowerCase() === 'holiday').length;
}

export function calculateRestCheckByShiftNurse(params: {
    shift: TShift;
    doc: TDutyDoc;
    policy: TRestLeavePolicy;
    year: number;
    month: number;
    adjustmentDays: number;
}) {
    const {shift, doc, policy, year, month, adjustmentDays} = params;

    if (!policy.enabled) return undefined;

    const monthlyTarget = calculateRestTarget(policy, year, month, countHolidayDays(shift.days)) + adjustmentDays;
    const countedRestShiftTypeIds = new Set(resolveCountedRestShiftTypeIds(policy, shift.wardShiftTypes));
    const shiftTypeByShortName = new Map(shift.wardShiftTypes.map((shiftType) => [shiftType.shortName, shiftType]));
    const restCheckByShiftNurseId: Record<number, TRestCheckSummary> = {};

    shift.divisionShiftNurses.forEach((division) => {
        division.forEach(({shiftNurse}) => {
            const docRow = doc.rows.find((row) => row.workerId === String(shiftNurse.shiftNurseId));
            const assignedDays =
                docRow?.cells.filter((cell) => {
                    if (!cell) return false;

                    const shiftType = shiftTypeByShortName.get(cell);

                    return shiftType !== undefined && countedRestShiftTypeIds.has(shiftType.wardShiftTypeId);
                }).length ?? 0;
            const carriedDays = policy.carryOverEnabled ? shiftNurse.carried : 0;
            const targetDays = Math.max(0, monthlyTarget + carriedDays);

            restCheckByShiftNurseId[shiftNurse.shiftNurseId] = {
                targetDays,
                assignedDays,
                carriedDays,
                carryOverApplied: policy.carryOverEnabled,
                differenceDays: assignedDays - targetDays,
            };
        });
    });

    return restCheckByShiftNurseId;
}
