import {type TCreateWardDTO} from '@dutying/api/ward';
import i18n from '@/i18n';
import {type useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TRegisterWardTranslator = ReturnType<typeof useTypedTranslation>['t'];

export const DEFAULT_WARD_SHIFT_TYPES: TCreateWardDTO['wardShiftTypes'] = [
    {
        name: '\uB370\uC774',
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
        name: '\uC774\uBE0C\uB2DD',
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
        name: '\uB098\uC774\uD2B8',
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
        name: '\uC624\uD504',
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
    D: 'feature.registerWard.defaultShiftType.day',
    E: 'feature.registerWard.defaultShiftType.evening',
    N: 'feature.registerWard.defaultShiftType.night',
    O: 'feature.registerWard.defaultShiftType.off',
} as const;

export function createDefaultWardShiftTypes(t: TRegisterWardTranslator): TCreateWardDTO['wardShiftTypes'] {
    return DEFAULT_WARD_SHIFT_TYPES.map((shiftType) => ({
        ...shiftType,
        name:
            DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME[shiftType.shortName as keyof typeof DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME] !==
            undefined
                ? t(DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME[shiftType.shortName as keyof typeof DEFAULT_SHIFT_TYPE_NAME_KEY_BY_SHORT_NAME])
                : shiftType.name,
    }));
}

export function getWardShiftValidationMessage(wardShiftTypes: TCreateWardDTO['wardShiftTypes']) {
    const invalidShiftType = wardShiftTypes.find((shiftType) => {
        if (shiftType.name === '') return true;

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
