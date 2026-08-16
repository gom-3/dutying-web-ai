import type {TCreateShiftTypeDTO} from '@dutying/api/ward';
import type {TWardShiftType} from '@/entities/ward';

export const THREE_SHIFT_CLASSIFICATIONS = ['DAY', 'EVENING', 'NIGHT'] as const;
export const TWO_SHIFT_CLASSIFICATIONS = ['DAY', 'NIGHT', 'NIGHT_CONTINUATION'] as const;

export type TWardRotationMode = 'THREE' | 'TWO' | 'MIXED';
export type TWardShiftRotationSystem = NonNullable<TCreateShiftTypeDTO['rotationSystem']>;

function isThreeShiftClassification(classification: TWardShiftType['classification']) {
    return THREE_SHIFT_CLASSIFICATIONS.some((candidate) => candidate === classification);
}

function isTwoShiftClassification(classification: TWardShiftType['classification']) {
    return TWO_SHIFT_CLASSIFICATIONS.some((candidate) => candidate === classification);
}

function isLegacyTwoShiftSymbol(shiftType: TWardShiftType) {
    const shortName = shiftType.shortName.trim().replace('Ⓓ', 'ⓓ').replace('Ⓝ', 'ⓝ');

    return (shortName === 'ⓓ' && shiftType.classification === 'DAY') || (shortName === 'ⓝ' && shiftType.classification === 'NIGHT');
}

export function resolveWardShiftRotationSystem(shiftType: TWardShiftType): TWardShiftRotationSystem {
    if (
        shiftType.isOff ||
        shiftType.classification === 'OFF' ||
        shiftType.classification === 'ANNUAL_LEAVE' ||
        shiftType.classification === 'OTHER_LEAVE'
    )
        return 'NONE';

    if (shiftType.rotationSystem === 'TWO') return isTwoShiftClassification(shiftType.classification) ? 'TWO' : 'NONE';

    if (shiftType.rotationSystem === 'THREE') return isThreeShiftClassification(shiftType.classification) ? 'THREE' : 'NONE';

    if (shiftType.rotationSystem === 'NONE') return 'NONE';

    if (isLegacyTwoShiftSymbol(shiftType)) return 'TWO';

    return shiftType.isDefault && isThreeShiftClassification(shiftType.classification) ? 'THREE' : 'NONE';
}

export function inferWardRotationMode(shiftTypes: TWardShiftType[]): TWardRotationMode {
    const activeRotationSystems = new Set(
        shiftTypes.filter((shiftType) => shiftType.isActive !== false).map(resolveWardShiftRotationSystem),
    );
    const hasThree = activeRotationSystems.has('THREE');
    const hasTwo = activeRotationSystems.has('TWO');

    if (hasThree && hasTwo) return 'MIXED';

    return hasTwo ? 'TWO' : 'THREE';
}
