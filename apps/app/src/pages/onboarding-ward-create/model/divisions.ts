import {getDefaultDivisionName, getDivisionCustomName} from '@/shared/lib/division-label';
import type {TOnboardingWardDraft} from './draft';

const normalizeNumber = (value?: number | null) => (Number.isInteger(value) && value! > 0 ? value! : 1);
const divisionTargets = (value: unknown): number[] => {
    if (!value || typeof value !== 'object') return [];

    if ('type' in value && value.type === 'DIVISION' && 'divisionNum' in value && typeof value.divisionNum === 'number') {
        return [normalizeNumber(value.divisionNum)];
    }

    return Object.values(value).flatMap(divisionTargets);
};
const remapTargets = (value: unknown, getNumber: (number: number) => number): unknown => {
    if (!value || typeof value !== 'object') return value;

    if (Array.isArray(value)) return value.map((item) => remapTargets(item, getNumber));

    if ('type' in value && value.type === 'DIVISION' && 'divisionNum' in value && typeof value.divisionNum === 'number') {
        const previousNumber = normalizeNumber(value.divisionNum);
        const divisionNum = getNumber(previousNumber);
        const labels = Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => key === 'name' || key === 'label')
                .map(([key, label]) => [
                    key,
                    typeof label === 'string' ? getDivisionCustomName(previousNumber, label) || getDefaultDivisionName(divisionNum) : label,
                ]),
        );

        return {...value, ...labels, divisionNum};
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapTargets(item, getNumber)]));
};

export const shiftOnboardingDivisionTargets = (
    draft: TOnboardingWardDraft,
    teamId: string,
    boundary: number,
    change: 1 | -1,
): TOnboardingWardDraft => ({
    ...draft,
    constraintCandidates: draft.constraintCandidates.map((constraint) => {
        const params = constraint.paramsByTeamId?.[teamId] ?? constraint.params;

        if (!divisionTargets(params).length) return constraint;

        return {
            ...constraint,
            paramsByTeamId: {
                ...constraint.paramsByTeamId,
                [teamId]: remapTargets(params, (number) => (number > boundary ? Math.max(boundary, number + change) : number)) as Record<
                    string,
                    unknown
                >,
            },
        };
    }),
});

// Onboarding owns new group numbers. Never apply this to an existing ward or
// reorder nurses: their row order is also the scheduling seniority order.
export const normalizeOnboardingDivisions = (draft: TOnboardingWardDraft): TOnboardingWardDraft => {
    const numbersByTeamId = new Map<string, Map<number, number>>();
    const nurseById = new Map(draft.nurses.map((nurse) => [nurse.id, nurse]));
    const getRowNumber = (teamId: string, row: {nurseId: string | null; divisionNum?: number}) => {
        const nurse = row.nurseId ? nurseById.get(row.nurseId) : undefined;

        return normalizeNumber(nurse?.teamId === teamId ? nurse.divisionNum : row.divisionNum);
    };
    const teams = draft.teams.map((team) => {
        const usedNumbers = new Set(
            draft.nurses.filter((nurse) => nurse.teamId === team.id).map((nurse) => normalizeNumber(nurse.divisionNum)),
        );
        const scheduleNumbers = new Set<number>();

        for (const schedule of Object.values(draft.scheduleInputs?.[team.id] ?? {})) {
            for (const row of schedule?.rows ?? []) scheduleNumbers.add(getRowNumber(team.id, row));
        }

        const orderedNumbers = Array.from(usedNumbers).sort((left, right) => left - right);

        // A row left in an earlier source month after roster deletion must not
        // reserve the first visible roster group number.
        for (const number of Array.from(scheduleNumbers).sort((left, right) => left - right)) {
            if (!usedNumbers.has(number)) {
                usedNumbers.add(number);
                orderedNumbers.push(number);
            }
        }

        // Empty metadata (especially the implicit group 1) must not make the
        // first visible group start at 2 or retain gaps from imported files.
        if (!usedNumbers.size) {
            usedNumbers.add(1);
            orderedNumbers.push(1);
        }

        const referencedNumbers = draft.constraintCandidates.flatMap((constraint) =>
            divisionTargets(constraint.paramsByTeamId?.[team.id] ?? constraint.params),
        );

        // An empty group used by a rule stays empty and cannot accidentally
        // target another group after compacting the visible groups.
        for (const number of referencedNumbers)
            if (!usedNumbers.has(number)) {
                usedNumbers.add(number);
                orderedNumbers.push(number);
            }

        const numbers = new Map(orderedNumbers.map((number, index) => [number, index + 1]));
        const names = new Map(team.divisions?.map((division) => [normalizeNumber(division.divisionNum), division.name]));

        numbersByTeamId.set(team.id, numbers);

        return {
            ...team,
            divisions: Array.from(numbers, ([previousNumber, divisionNum]) => ({
                divisionNum,
                name: getDivisionCustomName(previousNumber, names.get(previousNumber)) || getDefaultDivisionName(divisionNum),
            })),
        };
    });
    const getNumber = (teamId: string, previousNumber?: number) =>
        numbersByTeamId.get(teamId)?.get(normalizeNumber(previousNumber)) ?? normalizeNumber(previousNumber);

    return {
        ...draft,
        teams,
        nurses: draft.nurses.map((nurse) => ({...nurse, divisionNum: getNumber(nurse.teamId, nurse.divisionNum)})),
        scheduleInputs: Object.fromEntries(
            Object.entries(draft.scheduleInputs ?? {}).map(([teamId, schedules]) => [
                teamId,
                schedules &&
                    Object.fromEntries(
                        Object.entries(schedules).map(([month, schedule]) => [
                            month,
                            schedule && {
                                ...schedule,
                                rows: schedule.rows.map((row) => ({...row, divisionNum: getNumber(teamId, getRowNumber(teamId, row))})),
                            },
                        ]),
                    ),
            ]),
        ),
        constraintCandidates: draft.constraintCandidates.map((constraint) => {
            if (!divisionTargets(constraint.params).length && !constraint.paramsByTeamId) return constraint;

            const firstTeamId = draft.teams[0]?.id;

            return {
                ...constraint,
                params: firstTeamId
                    ? (remapTargets(constraint.paramsByTeamId?.[firstTeamId] ?? constraint.params, (number) =>
                          getNumber(firstTeamId, number),
                      ) as Record<string, unknown>)
                    : constraint.params,
                paramsByTeamId: Object.fromEntries(
                    draft.teams.map((team) => [
                        team.id,
                        remapTargets(constraint.paramsByTeamId?.[team.id] ?? constraint.params, (number) =>
                            getNumber(team.id, number),
                        ) as Record<string, unknown>,
                    ]),
                ),
            };
        }),
    };
};
