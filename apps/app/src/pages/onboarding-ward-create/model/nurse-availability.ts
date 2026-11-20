import {isRestShiftOption} from '@/shared/lib/shift-rotation-selection';
import type {TOnboardingWardDraft} from './draft';
import {createScheduleShiftTypeResolver} from './schedule-shift-reference';

function getRosterCodesByNurse(draft: TOnboardingWardDraft) {
    const codesByNurse = new Map<string, Set<string>>();

    for (const [teamId, months] of Object.entries(draft.scheduleInputs ?? {})) {
        const teamNurses = draft.nurses.filter((nurse) => nurse.teamId === teamId);
        const ids = new Set(teamNurses.map((nurse) => nurse.id));
        const idByName = new Map<string, string | null>();

        for (const nurse of teamNurses) {
            const name = nurse.name.trim();

            idByName.set(name, idByName.has(name) ? null : nurse.id);
        }

        for (const schedule of Object.values(months ?? {})) {
            if (!schedule) continue;

            const lastDay = new Date(schedule.year, schedule.month, 0).getDate();

            for (const row of schedule.rows) {
                const id = row.nurseId && ids.has(row.nurseId) ? row.nurseId : idByName.get(row.name.trim());

                if (!id) continue;

                const codes = codesByNurse.get(id) ?? new Set<string>();

                for (const [key, value] of Object.entries(row.shifts)) {
                    const day = Number(key);

                    if (Number.isInteger(day) && day >= 1 && day <= lastDay && value.trim()) codes.add(value.trim());
                }

                codesByNurse.set(id, codes);
            }
        }
    }

    return codesByNurse;
}

const sameCodes = (left: string[] | null, right: string[] | null) =>
    left === right ||
    (left !== null && right !== null && left.length === right.length && left.every((code, index) => code === right[index]));

export function applyRosterAvailability(
    draft: TOnboardingWardDraft,
    {editedNurseId, restoreSavedChoices = false}: {editedNurseId?: string; restoreSavedChoices?: boolean} = {},
): TOnboardingWardDraft {
    const active = draft.shiftTypes.filter((type) => type.isActive !== false);
    const workTypes = active.filter((type) => !isRestShiftOption(type));
    const resolveType = createScheduleShiftTypeResolver({...draft, shiftTypes: active});
    const rosterCodes = getRosterCodesByNurse(draft);
    const nurses = draft.nurses.map((nurse) => {
        if (editedNurseId && nurse.id !== editedNurseId) return nurse;

        // The editable grid is authoritative, including cells cleared since the server preview.
        const codes =
            rosterCodes.get(nurse.id) ?? new Set(nurse.initialShifts?.map((shift) => shift.shiftShortName.trim()).filter(Boolean));
        const observedWork = new Set<string>();

        for (const code of codes) {
            const type = resolveType(code);

            if (type && !isRestShiftOption(type)) observedWork.add(type.shortName);
        }

        // No history keeps the usual defaults. A row containing only leave has zero observed work shifts.
        const observed = codes.size ? [...observedWork].sort() : null;
        const selected = workTypes
            .filter((type) => nurse.possibleShiftTypeIds.includes(type.id))
            .map((type) => type.shortName)
            .sort();

        let override = nurse.workShiftOverride;

        if (override && !sameCodes(override.observed, observed)) override = undefined;

        const hasLegacySelection =
            restoreSavedChoices &&
            draft.onboardingSignals?.possibleShiftsEdited &&
            nurse.workShiftOverride === undefined &&
            selected.length < workTypes.length;

        if (editedNurseId === nurse.id || hasLegacySelection) {
            override = sameCodes(selected, observed) ? undefined : {observed, selected};
        }

        const allowedWork = new Set(override?.selected ?? observed ?? selected);

        return {
            ...nurse,
            workShiftOverride: override ?? null,
            possibleShiftTypeIds: active
                .filter((type) => isRestShiftOption(type) || allowedWork.has(type.shortName))
                .map((type) => type.id),
        };
    });

    return {...draft, nurses};
}
