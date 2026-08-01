import {type TNurseShiftType, type TWardShiftType} from '@/entities';

export const DEFAULT_NURSE_SHIFT_RATIO_WEIGHT = 7;

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
const normalizeShiftTypeKey = (value?: string | null) => value?.trim().toLocaleUpperCase() ?? '';
const setIfAbsent = <T>(map: Map<string, T>, key: string, value: T) => {
    if (!key || map.has(key)) return;

    map.set(key, value);
};

export const resolveNurseShiftTypeOptions = (
    nurseShiftTypes: TNurseShiftType[],
    wardShiftTypes: TWardShiftType[] | undefined,
): TNurseShiftTypeOption[] => {
    if (!wardShiftTypes?.length) {
        return sortByWardShiftTypeId(nurseShiftTypes).map((shiftType) => ({
            ...shiftType,
            targetRatioWeight: shiftType.targetRatioWeight ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT,
            apiShiftTypeId: shiftType.nurseShiftTypeId,
        }));
    }

    const nurseShiftTypeByWardShiftTypeId = new Map<number, TNurseShiftType>();
    const legacyNurseShiftTypeByCode = new Map<string, TNurseShiftType>();

    nurseShiftTypes.forEach((shiftType) => {
        if (typeof shiftType.wardShiftTypeId === 'number') {
            nurseShiftTypeByWardShiftTypeId.set(shiftType.wardShiftTypeId, shiftType);

            return;
        }

        setIfAbsent(legacyNurseShiftTypeByCode, normalizeShiftTypeKey(shiftType.shortName), shiftType);
        setIfAbsent(legacyNurseShiftTypeByCode, normalizeShiftTypeKey(shiftType.name), shiftType);
    });

    return wardShiftTypes
        .filter((wardShiftType) => wardShiftType.isActive !== false)
        .sort((a, b) => a.wardShiftTypeId - b.wardShiftTypeId)
        .map((wardShiftType) => {
            const matched =
                nurseShiftTypeByWardShiftTypeId.get(wardShiftType.wardShiftTypeId) ??
                legacyNurseShiftTypeByCode.get(normalizeShiftTypeKey(wardShiftType.shortName)) ??
                legacyNurseShiftTypeByCode.get(normalizeShiftTypeKey(wardShiftType.name));
            const shortName = wardShiftType.shortName || wardShiftType.name;
            const name = wardShiftType.name || shortName;

            return {
                nurseShiftTypeId: matched?.nurseShiftTypeId ?? wardShiftType.wardShiftTypeId,
                wardShiftTypeId: wardShiftType.wardShiftTypeId,
                name,
                shortName,
                isPossible: matched?.isPossible ?? true,
                isPreferred: matched?.isPreferred ?? false,
                targetRatioWeight: matched?.targetRatioWeight ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT,
                apiShiftTypeId: matched?.nurseShiftTypeId ?? wardShiftType.wardShiftTypeId,
            };
        });
};
