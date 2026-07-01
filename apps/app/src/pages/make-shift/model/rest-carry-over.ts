import type {QueryClient} from '@tanstack/react-query';
import type {TShift} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import type {TRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {NurseAPI} from '@/shared/api';
import type {TRestCheckSummary} from './rest-target-days';

function nextYearMonth(year: number, month: number) {
    if (month === 12) return {year: year + 1, month: 1};

    return {year, month: month + 1};
}

function getShiftNurseByNurseId(shift: TShift) {
    return new Map(
        shift.divisionShiftNurses
            .flatMap((division) => division.map((row) => row.shiftNurse))
            .filter((shiftNurse) => shiftNurse.nurseId != null)
            .map((shiftNurse) => [shiftNurse.nurseId, shiftNurse]),
    );
}

function getShiftNurseByName(shift: TShift) {
    return new Map(
        shift.divisionShiftNurses
            .flatMap((division) => division.map((row) => row.shiftNurse))
            .map((shiftNurse) => [shiftNurse.name.trim(), shiftNurse]),
    );
}

function applyCarryOverToShift(shift: TShift, carriedByShiftNurseId: Map<number, number>): TShift {
    return {
        ...shift,
        divisionShiftNurses: shift.divisionShiftNurses.map((division) =>
            division.map((row) => {
                const carried = carriedByShiftNurseId.get(row.shiftNurse.shiftNurseId);

                if (carried === undefined) return row;

                return {
                    ...row,
                    shiftNurse: {
                        ...row.shiftNurse,
                        carried,
                    },
                };
            }),
        ),
    };
}

export async function syncNextMonthRestCarryOver(params: {
    wardId: number;
    shiftTeamId: number;
    year: number;
    month: number;
    shift: TShift;
    policy: TRestLeavePolicy;
    restCheckByShiftNurseId: Record<number, TRestCheckSummary> | undefined;
    queryClient: QueryClient;
}) {
    const {wardId, shiftTeamId, year, month, shift, policy, restCheckByShiftNurseId, queryClient} = params;

    if (!policy.enabled || !policy.carryOverEnabled || !restCheckByShiftNurseId) return;

    const next = nextYearMonth(year, month);
    const nextDutyQueryOptions = wardQueryOptions.duty(wardId, shiftTeamId, next.year, next.month);
    const nextShift = await queryClient.fetchQuery(nextDutyQueryOptions);
    const nextShiftNurseByNurseId = getShiftNurseByNurseId(nextShift);
    const nextShiftNurseByName = getShiftNurseByName(nextShift);
    const updates = shift.divisionShiftNurses.flatMap((division) =>
        division.flatMap((row) => {
            const restCheck = restCheckByShiftNurseId[row.shiftNurse.shiftNurseId];
            const nextShiftNurse =
                nextShiftNurseByNurseId.get(row.shiftNurse.nurseId) ?? nextShiftNurseByName.get(row.shiftNurse.name.trim());

            if (!restCheck || !nextShiftNurse) return [];

            return [{shiftNurseId: nextShiftNurse.shiftNurseId, carried: -restCheck.differenceDays}];
        }),
    );
    const carriedByShiftNurseId = new Map(updates.map((update) => [update.shiftNurseId, update.carried]));

    await Promise.all(updates.map((update) => NurseAPI.updateNurseCarry(update.shiftNurseId, update.carried)));
    queryClient.setQueryData(nextDutyQueryOptions.queryKey, applyCarryOverToShift(nextShift, carriedByShiftNurseId));
    await queryClient.invalidateQueries({queryKey: nextDutyQueryOptions.queryKey});
}
