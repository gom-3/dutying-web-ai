import {type TCreateWardDTO} from '@dutying/api/ward';
import i18n from '@/i18n';
import {type useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TRegisterWardTranslator = ReturnType<typeof useTypedTranslation>['t'];

export const DEFAULT_WARD_SHIFT_TYPES: TCreateWardDTO['wardShiftTypes'] = [
    {
        name: 'Day',
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#4DC2AD',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'DAY',
    },
    {
        name: 'Evening',
        shortName: 'E',
        startTime: '15:00',
        endTime: '23:00',
        color: '#FF8BA5',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'EVENING',
    },
    {
        name: 'Night',
        shortName: 'N',
        startTime: '23:00',
        endTime: '07:00',
        color: '#3580FF',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'NIGHT',
    },
    {
        name: 'Off',
        shortName: 'O',
        startTime: '',
        endTime: '',
        color: '#465B7A',
        isDefault: true,
        isOff: true,
        isCounted: false,
        classification: 'OFF',
    },
];

const DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME = {
    D: 'day',
    E: 'evening',
    N: 'night',
    O: 'off',
} as const;

export function createDefaultWardShiftTypes(t: TRegisterWardTranslator): TCreateWardDTO['wardShiftTypes'] {
    return DEFAULT_WARD_SHIFT_TYPES.map((shiftType) => ({
        ...shiftType,
        name: t(
            `feature.registerWard.defaultShiftType.${DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME[shiftType.shortName as 'D' | 'E' | 'N' | 'O']}`,
        ),
    }));
}

export function getWardShiftValidationMessage(wardShiftTypes: TCreateWardDTO['wardShiftTypes']) {
    const invalidShiftType = wardShiftTypes.find((shiftType) => {
        if (shiftType.name === '') {
            return true;
        }

        if (!shiftType.isOff && (shiftType.startTime === '' || shiftType.endTime === '')) {
            return true;
        }

        return shiftType.shortName === '';
    });

    if (!invalidShiftType) return null;

    if (invalidShiftType.name === '') {
        return i18n.t('feature.registerWard.validation.nameRequired');
    }

    if (!invalidShiftType.isOff && (invalidShiftType.startTime === '' || invalidShiftType.endTime === '')) {
        return i18n.t('feature.registerWard.validation.timeRequired', {name: invalidShiftType.name});
    }

    return i18n.t('feature.registerWard.validation.shortNameRequired', {name: invalidShiftType.name});
}
