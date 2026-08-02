import {type TNurseShiftType, type TWardShiftType} from '@/entities';

export const DEFAULT_NURSE_SHIFT_RATIO_WEIGHT = 7;
export const MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS = [
    'DAY',
    'EVENING',
    'NIGHT',
    'OFF',
] as const satisfies readonly TWardShiftType['classification'][];

type TMonthlyNurseShiftRatioClassification = (typeof MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS)[number];
type TMonthlyNurseShiftRatioWeightMap = Partial<Record<TMonthlyNurseShiftRatioClassification, number>>;

const MONTHLY_NURSE_SHIFT_RATIO_DEFAULTS: Record<string, TMonthlyNurseShiftRatioWeightMap> = {
    DAY: {DAY: 21},
    EVENING: {EVENING: 21},
    NIGHT: {NIGHT: 14},
    OFF: {OFF: 30},
    'DAY|EVENING': {DAY: 11, EVENING: 10},
    'DAY|NIGHT': {DAY: 15, NIGHT: 5},
    'DAY|OFF': {DAY: 21, OFF: 9},
    'EVENING|NIGHT': {EVENING: 15, NIGHT: 5},
    'EVENING|OFF': {EVENING: 21, OFF: 9},
    'NIGHT|OFF': {NIGHT: 15, OFF: 15},
    'DAY|EVENING|NIGHT': {DAY: 9, EVENING: 6, NIGHT: 5},
    'DAY|EVENING|OFF': {DAY: 11, EVENING: 10, OFF: 9},
    'DAY|NIGHT|OFF': {DAY: 15, NIGHT: 5, OFF: 10},
    'EVENING|NIGHT|OFF': {EVENING: 15, NIGHT: 5, OFF: 10},
    'DAY|EVENING|NIGHT|OFF': {DAY: 9, EVENING: 6, NIGHT: 5, OFF: 10},
};
const LEGACY_MONTHLY_NURSE_SHIFT_RATIO_DEFAULTS: Record<string, TMonthlyNurseShiftRatioWeightMap> = {
    'NIGHT|OFF': {NIGHT: 14, OFF: 16},
};
const LEGACY_MONTHLY_NURSE_SHIFT_RATIO_DEFAULT_PROFILES: Record<string, TMonthlyNurseShiftRatioWeightMap[]> = {
    'NIGHT|OFF': [
        {NIGHT: 14, OFF: 16},
        {NIGHT: 5, OFF: 16},
    ],
};
const MONTHLY_NURSE_SHIFT_RATIO_DEFAULTISH_WEIGHTS = [MONTHLY_NURSE_SHIFT_RATIO_DEFAULTS, LEGACY_MONTHLY_NURSE_SHIFT_RATIO_DEFAULTS].reduce<
    Record<TMonthlyNurseShiftRatioClassification, Set<number>>
>(
    (acc, defaults) => {
        Object.values(defaults).forEach((weightMap) => {
            MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS.forEach((classification) => {
                const weight = weightMap[classification];

                if (typeof weight === 'number') {
                    acc[classification].add(weight);
                }
            });
        });

        return acc;
    },
    {
        DAY: new Set([DEFAULT_NURSE_SHIFT_RATIO_WEIGHT]),
        EVENING: new Set([DEFAULT_NURSE_SHIFT_RATIO_WEIGHT]),
        NIGHT: new Set([DEFAULT_NURSE_SHIFT_RATIO_WEIGHT]),
        OFF: new Set([DEFAULT_NURSE_SHIFT_RATIO_WEIGHT]),
    },
);

export type TNurseShiftTypeOption = TNurseShiftType & {
    apiShiftTypeId: number;
};
type TResolveNurseShiftTypeOptionsConfig = {
    preserveTargetRatioWeightKeys?: ReadonlySet<string>;
};

export const isMonthlyNurseShiftRatioClassification = (
    classification: TWardShiftType['classification'] | null | undefined,
): classification is TMonthlyNurseShiftRatioClassification =>
    MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS.some((targetClassification) => targetClassification === classification);

export const getMonthlyNurseShiftRatioClassificationOrder = (classification: TWardShiftType['classification'] | null | undefined) => {
    const index = MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS.findIndex((targetClassification) => targetClassification === classification);

    return index === -1 ? MONTHLY_NURSE_SHIFT_RATIO_CLASSIFICATIONS.length : index;
};

const getMonthlyNurseShiftRatioDefaultKey = (classifications: Array<TWardShiftType['classification'] | null | undefined>) =>
    Array.from(new Set(classifications.filter(isMonthlyNurseShiftRatioClassification)))
        .sort((left, right) => getMonthlyNurseShiftRatioClassificationOrder(left) - getMonthlyNurseShiftRatioClassificationOrder(right))
        .join('|');

export const getDefaultMonthlyNurseShiftRatioWeights = (
    classifications: Array<TWardShiftType['classification'] | null | undefined>,
): TMonthlyNurseShiftRatioWeightMap => MONTHLY_NURSE_SHIFT_RATIO_DEFAULTS[getMonthlyNurseShiftRatioDefaultKey(classifications)] ?? {};

export const getDefaultMonthlyNurseShiftRatioWeight = (
    classification: TWardShiftType['classification'] | null | undefined,
    possibleClassifications: Array<TWardShiftType['classification'] | null | undefined>,
) => {
    if (!isMonthlyNurseShiftRatioClassification(classification)) return DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;

    return getDefaultMonthlyNurseShiftRatioWeights(possibleClassifications)[classification] ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;
};

export const isDefaultMonthlyNurseShiftRatioWeight = (
    classification: TWardShiftType['classification'] | null | undefined,
    weight: number | null | undefined,
) => {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) return true;
    if (!isMonthlyNurseShiftRatioClassification(classification)) return Math.round(weight) === DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;

    return MONTHLY_NURSE_SHIFT_RATIO_DEFAULTISH_WEIGHTS[classification].has(Math.round(weight));
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
    config?: TResolveNurseShiftTypeOptionsConfig,
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

    const options = wardShiftTypes
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
                targetRatioWeight: matched?.targetRatioWeight,
                apiShiftTypeId: matched?.nurseShiftTypeId ?? wardShiftType.wardShiftTypeId,
                classification: wardShiftType.classification,
            };
        });

    const possibleMonthlyOptions = options.flatMap((shiftType) =>
        shiftType.isPossible && isMonthlyNurseShiftRatioClassification(shiftType.classification)
            ? [{...shiftType, classification: shiftType.classification}]
            : [],
    );
    const possibleClassifications = possibleMonthlyOptions.map(({classification}) => classification);
    const monthlyDefaultKey = getMonthlyNurseShiftRatioDefaultKey(possibleClassifications);
    const hasStoredNeutralDefaultProfile =
        possibleMonthlyOptions.length > 0 &&
        possibleMonthlyOptions.every(
            (shiftType) =>
                typeof shiftType.targetRatioWeight === 'number' &&
                Number.isFinite(shiftType.targetRatioWeight) &&
                Math.round(shiftType.targetRatioWeight) === DEFAULT_NURSE_SHIFT_RATIO_WEIGHT,
        );
    const hasStoredLegacyDefaultProfile = (LEGACY_MONTHLY_NURSE_SHIFT_RATIO_DEFAULT_PROFILES[monthlyDefaultKey] ?? []).some((weightMap) =>
        possibleMonthlyOptions.every((shiftType) => {
            const expectedWeight = weightMap[shiftType.classification];

            return (
                typeof expectedWeight === 'number' &&
                typeof shiftType.targetRatioWeight === 'number' &&
                Number.isFinite(shiftType.targetRatioWeight) &&
                Math.round(shiftType.targetRatioWeight) === expectedWeight
            );
        }),
    );
    const shouldApplyStoredDefaultProfile = hasStoredNeutralDefaultProfile || hasStoredLegacyDefaultProfile;

    return options.map(({classification, ...shiftType}) => {
        const shouldPreserveTargetRatioWeight =
            config?.preserveTargetRatioWeightKeys?.has(getNurseShiftTypeKey(shiftType)) &&
            typeof shiftType.targetRatioWeight === 'number' &&
            Number.isFinite(shiftType.targetRatioWeight);
        const shouldUseComputedDefaultWeight =
            !shouldPreserveTargetRatioWeight &&
            (typeof shiftType.targetRatioWeight !== 'number' ||
                !Number.isFinite(shiftType.targetRatioWeight) ||
                (shouldApplyStoredDefaultProfile && isMonthlyNurseShiftRatioClassification(classification)));

        return {
            ...shiftType,
            targetRatioWeight: shouldUseComputedDefaultWeight
                ? getDefaultMonthlyNurseShiftRatioWeight(classification, possibleClassifications)
                : shiftType.targetRatioWeight,
        };
    });
};
