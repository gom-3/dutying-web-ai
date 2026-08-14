export type TSelectableShiftRotationSystem = 'THREE' | 'TWO' | 'NONE';
export type TSelectableShiftClassification = 'DAY' | 'EVENING' | 'NIGHT' | 'NIGHT_CONTINUATION' | 'OTHER_WORK' | 'OFF' | 'OTHER_LEAVE';
export type TSelectableWardRotationMode = 'THREE' | 'TWO' | 'MIXED';

export const SELECTABLE_SHIFT_ROTATION_SYSTEMS = ['THREE', 'TWO', 'NONE'] as const;

const SELECTABLE_SHIFT_ROTATION_SYSTEMS_BY_WARD_MODE = {
    THREE: ['THREE', 'NONE'],
    TWO: ['TWO', 'NONE'],
    MIXED: SELECTABLE_SHIFT_ROTATION_SYSTEMS,
} as const satisfies Record<TSelectableWardRotationMode, readonly TSelectableShiftRotationSystem[]>;
const CLASSIFICATIONS_BY_ROTATION: Record<TSelectableShiftRotationSystem, readonly TSelectableShiftClassification[]> = {
    THREE: ['DAY', 'EVENING', 'NIGHT'],
    TWO: ['DAY', 'NIGHT', 'NIGHT_CONTINUATION'],
    NONE: ['OFF', 'OTHER_WORK', 'OTHER_LEAVE'],
};
const CLASSIFICATIONS_BY_WARD_MODE = {
    THREE: ['DAY', 'EVENING', 'NIGHT', 'OFF', 'OTHER_WORK', 'OTHER_LEAVE'],
    TWO: ['DAY', 'NIGHT', 'NIGHT_CONTINUATION', 'OFF', 'OTHER_WORK', 'OTHER_LEAVE'],
    MIXED: ['DAY', 'EVENING', 'NIGHT', 'NIGHT_CONTINUATION', 'OFF', 'OTHER_WORK', 'OTHER_LEAVE'],
} as const satisfies Record<TSelectableWardRotationMode, readonly TSelectableShiftClassification[]>;
const TIME_RANGE_BY_ROTATION_CLASSIFICATION: Partial<
    Record<TSelectableShiftRotationSystem, Partial<Record<TSelectableShiftClassification, {startTime: string; endTime: string}>>>
> = {
    THREE: {
        DAY: {startTime: '07:00', endTime: '15:00'},
        EVENING: {startTime: '15:00', endTime: '22:00'},
        NIGHT: {startTime: '22:00', endTime: '07:00'},
    },
    TWO: {
        DAY: {startTime: '07:00', endTime: '19:00'},
        NIGHT: {startTime: '19:00', endTime: '07:00'},
        NIGHT_CONTINUATION: {startTime: '00:00', endTime: '07:00'},
    },
};

export function getSelectableClassificationsForRotation(
    rotationSystem: TSelectableShiftRotationSystem,
    options: {primaryOff?: boolean} = {},
) {
    if (options.primaryOff) return ['OFF'] as const;

    return CLASSIFICATIONS_BY_ROTATION[rotationSystem];
}

export function getSelectableShiftRotationSystemsForWardMode(rotationMode: TSelectableWardRotationMode) {
    return SELECTABLE_SHIFT_ROTATION_SYSTEMS_BY_WARD_MODE[rotationMode];
}

export function getSelectableClassificationsForWardMode(rotationMode: TSelectableWardRotationMode) {
    return CLASSIFICATIONS_BY_WARD_MODE[rotationMode];
}

export function getSelectableRotationSystemsForClassification(
    rotationMode: TSelectableWardRotationMode,
    classification: TSelectableShiftClassification,
): readonly TSelectableShiftRotationSystem[] {
    if (classification === 'OFF' || classification === 'OTHER_WORK' || classification === 'OTHER_LEAVE') return ['NONE'];

    if (classification === 'EVENING') return rotationMode === 'TWO' ? [] : ['THREE'];

    if (classification === 'NIGHT_CONTINUATION') return rotationMode === 'THREE' ? [] : ['TWO'];

    if (rotationMode === 'THREE') return ['THREE'];

    if (rotationMode === 'TWO') return ['TWO'];

    return ['THREE', 'TWO'];
}

export function getRequiredRotationClassifications(rotationMode: TSelectableWardRotationMode) {
    return [
        ...(rotationMode !== 'TWO'
            ? [
                  {rotationSystem: 'THREE' as const, classification: 'DAY' as const},
                  {rotationSystem: 'THREE' as const, classification: 'EVENING' as const},
                  {rotationSystem: 'THREE' as const, classification: 'NIGHT' as const},
              ]
            : []),
        ...(rotationMode !== 'THREE'
            ? [
                  {rotationSystem: 'TWO' as const, classification: 'DAY' as const},
                  {rotationSystem: 'TWO' as const, classification: 'NIGHT' as const},
              ]
            : []),
        {rotationSystem: 'NONE' as const, classification: 'OFF' as const},
    ];
}

export function getRequiredRotationClassificationCounts(
    rotationMode: TSelectableWardRotationMode,
    shiftTypes: ReadonlyArray<{
        classification: TSelectableShiftClassification;
        rotationSystem?: TSelectableShiftRotationSystem;
    }>,
) {
    return getRequiredRotationClassifications(rotationMode).map((requiredShiftType) => ({
        ...requiredShiftType,
        count: shiftTypes.filter(
            (shiftType) =>
                shiftType.rotationSystem === requiredShiftType.rotationSystem &&
                shiftType.classification === requiredShiftType.classification,
        ).length,
    }));
}

export function getFirstAvailableClassificationForRotation({
    rotationSystem,
    currentClassification,
    usedClassifications,
    primaryOff = false,
}: {
    rotationSystem: TSelectableShiftRotationSystem;
    currentClassification: TSelectableShiftClassification;
    usedClassifications: ReadonlySet<TSelectableShiftClassification>;
    primaryOff?: boolean;
}) {
    const classifications = getSelectableClassificationsForRotation(rotationSystem, {primaryOff});

    if (
        classifications.some((classification) => classification === currentClassification) &&
        !usedClassifications.has(currentClassification)
    ) {
        return currentClassification;
    }

    return classifications.find((classification) => !usedClassifications.has(classification)) ?? null;
}

export function getDefaultTimeRangeForRotation(
    rotationSystem: TSelectableShiftRotationSystem,
    classification: TSelectableShiftClassification,
) {
    return TIME_RANGE_BY_ROTATION_CLASSIFICATION[rotationSystem]?.[classification] ?? null;
}
