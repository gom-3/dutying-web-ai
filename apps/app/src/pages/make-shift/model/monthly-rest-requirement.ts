import type {TMonthlyRestRequirement} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import {
    calculateRestTargetForPolicy,
    normalizeRestLeavePolicy,
    resolveCountedRestShiftTypeIds,
    type TRestLeavePolicy,
    type TRestLeavePolicyResponse,
} from '@/pages/ward-settings/model/rest-leave-policy';
import axiosInstance from '@/shared/api/client';
import {loadRestTargetAdjustment} from './rest-target-adjustment';

export function monthlyRestRequirement(
    shift: TShift,
    policy: TRestLeavePolicy,
    year: number,
    month: number,
    adjustmentDays: number,
): TMonthlyRestRequirement | undefined {
    if (!policy.enabled) return undefined;

    const target = calculateRestTargetForPolicy(policy, year, month) + adjustmentDays;

    return {
        minimumDaysByShiftNurseId: Object.fromEntries(
            shift.divisionShiftNurses
                .flat()
                .filter(({shiftNurse}) => shiftNurse.isWorker)
                .map(({shiftNurse}) => [shiftNurse.shiftNurseId, Math.max(0, target + (policy.carryOverEnabled ? shiftNurse.carried : 0))]),
        ),
        countedWardShiftTypeIds: resolveCountedRestShiftTypeIds(policy, shift.wardShiftTypes),
    };
}

export async function loadMonthlyRestRequirement(wardId: number, shiftTeamId: number, shift: TShift, year: number, month: number) {
    const {data} = await axiosInstance.get<TRestLeavePolicyResponse>(`/wards/${wardId}/rest-leave-policy`, {suppressErrorToast: true});

    return monthlyRestRequirement(
        shift,
        normalizeRestLeavePolicy(data),
        year,
        month,
        loadRestTargetAdjustment({wardId, shiftTeamId, year, month}),
    );
}
