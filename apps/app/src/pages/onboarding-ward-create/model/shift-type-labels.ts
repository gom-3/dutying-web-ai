import {resources} from '@/shared/i18n/resources.generated';
import {
    DEFAULT_ONBOARDING_DRAFT_LABELS,
    type TOnboardingDraftLabels,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
} from './draft';

type TShiftName = keyof TOnboardingDraftLabels['shiftNames'];

const defaultNames = Object.values(resources).flatMap(({translation}) => {
    const common = {
        ...translation.feature.registerWard.defaultShiftType,
        annualLeave: translation.page.onboardingWardCreate.defaults.annualLeave,
    };

    return [
        {...common, ...translation.page.onboardingWardCreate.defaults},
        {
            ...common,
            twoDay: translation.page.onboardingWardCreate.shiftType.twoDayLabel,
            twoNight: translation.page.onboardingWardCreate.shiftType.twoNightLabel,
            twoNightContinuation: translation.page.onboardingWardCreate.shiftType.classification.nightContinuation,
        },
    ];
});
// Earlier catalogs saved these English fallbacks in every non-Korean locale.
const legacyNames: Partial<Record<TShiftName, readonly string[]>> = {
    day: ['天', 'วัน'],
    evening: ['晚上', 'ตอนเย็น'],
    night: ['骑士', '騎士', 'กลางคืน'],
    off: ['离开', '離開', 'ปิด'],
    twoDay: ['Two-shift day'],
    twoNight: ['Two-shift night'],
};

export const localizeOnboardingShiftNames = (draft: TOnboardingWardDraft, labels: TOnboardingDraftLabels): TOnboardingWardDraft => {
    const localize = (shiftType: TOnboardingWardShiftType): TOnboardingWardShiftType => {
        if (shiftType.autoSeeded === false || shiftType.source || shiftType.importedCode) return shiftType;

        const classification = shiftType.classification;
        const key: TShiftName | undefined =
            classification === 'DAY'
                ? shiftType.rotationSystem === 'TWO' && draft.rotationMode === 'MIXED'
                    ? 'twoDay'
                    : 'day'
                : classification === 'NIGHT'
                  ? shiftType.rotationSystem === 'TWO' && draft.rotationMode === 'MIXED'
                      ? 'twoNight'
                      : 'night'
                  : classification === 'EVENING'
                    ? 'evening'
                    : classification === 'OFF'
                      ? 'off'
                      : classification === 'ANNUAL_LEAVE'
                        ? 'annualLeave'
                        : classification === 'NIGHT_CONTINUATION'
                          ? 'twoNightContinuation'
                          : undefined;

        if (!key || shiftType.name === labels.shiftNames[key]) return shiftType;

        const name = shiftType.name.trim();
        const isDefaultName =
            name === DEFAULT_ONBOARDING_DRAFT_LABELS.shiftNames[key] ||
            defaultNames.some((names) => names[key] === name) ||
            legacyNames[key]?.includes(name);

        return isDefaultName ? {...shiftType, name: labels.shiftNames[key]} : shiftType;
    };
    const shiftTypes = draft.shiftTypes.map(localize);
    const sourceTypes = draft.scheduleInputState?.shiftTypes.map(localize);

    if (
        shiftTypes.every((shiftType, index) => shiftType === draft.shiftTypes[index]) &&
        sourceTypes?.every((shiftType, index) => shiftType === draft.scheduleInputState?.shiftTypes[index]) !== false
    )
        return draft;

    return {
        ...draft,
        shiftTypes,
        ...(draft.scheduleInputState && sourceTypes ? {scheduleInputState: {...draft.scheduleInputState, shiftTypes: sourceTypes}} : {}),
    };
};
