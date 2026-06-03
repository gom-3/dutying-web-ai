import {type TNurseShiftType, type TWardShiftType} from '@/entities';

export type TNurseShiftTypeOption = TNurseShiftType & {
    apiShiftTypeId: number;
};

export const getNurseShiftTypeKey = (shiftType: Pick<TNurseShiftType, 'nurseShiftTypeId' | 'wardShiftTypeId'>) => {
    if (typeof shiftType.wardShiftTypeId === 'number') {
        return `ward:${shiftType.wardShiftTypeId}`;
    }

    return `nurse:${shiftType.nurseShiftTypeId}`;
};

const sortByWardShiftTypeId = <T extends Pick<TNurseShiftType, 'nurseShiftTypeId' | 'wardShiftTypeId'>>(shiftTypes: T[]) =>
    [...shiftTypes].sort((a, b) => {
        const aId = a.wardShiftTypeId ?? a.nurseShiftTypeId;
        const bId = b.wardShiftTypeId ?? b.nurseShiftTypeId;

        return aId - bId;
    });

export const resolveNurseShiftTypeOptions = (
    nurseShiftTypes: TNurseShiftType[],
    wardShiftTypes: TWardShiftType[] | undefined,
): TNurseShiftTypeOption[] => {
    if (!wardShiftTypes?.length) {
        return sortByWardShiftTypeId(nurseShiftTypes).map((shiftType) => ({
            ...shiftType,
            apiShiftTypeId: shiftType.nurseShiftTypeId,
        }));
    }

    const nurseShiftTypeByWardShiftTypeId = new Map<number, TNurseShiftType>();
    const legacyNurseShiftTypeByName = new Map<string, TNurseShiftType>();

    nurseShiftTypes.forEach((shiftType) => {
        if (typeof shiftType.wardShiftTypeId === 'number') {
            nurseShiftTypeByWardShiftTypeId.set(shiftType.wardShiftTypeId, shiftType);

            return;
        }

        if (!legacyNurseShiftTypeByName.has(shiftType.name)) {
            legacyNurseShiftTypeByName.set(shiftType.name, shiftType);
        }
    });

    return [...wardShiftTypes]
        .sort((a, b) => a.wardShiftTypeId - b.wardShiftTypeId)
        .map((wardShiftType) => {
            const matched =
                nurseShiftTypeByWardShiftTypeId.get(wardShiftType.wardShiftTypeId) ?? legacyNurseShiftTypeByName.get(wardShiftType.name);

            return {
                nurseShiftTypeId: matched?.nurseShiftTypeId ?? wardShiftType.wardShiftTypeId,
                wardShiftTypeId: wardShiftType.wardShiftTypeId,
                name: wardShiftType.name,
                shortName: wardShiftType.shortName,
                isPossible: matched?.isPossible ?? true,
                isPreferred: matched?.isPreferred ?? false,
                apiShiftTypeId: matched?.nurseShiftTypeId ?? wardShiftType.wardShiftTypeId,
            };
        });
};
