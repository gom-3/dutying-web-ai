import {getLocaleForLanguage} from '@/shared/i18n/locale';
import type {TOnboardingNurseDraft} from './draft';
import type {TSortMode} from './types';

export const sortNursesByMode = (nurses: TOnboardingNurseDraft[], sortMode: TSortMode, language = 'ko'): TOnboardingNurseDraft[] => {
    const onNurses = nurses.filter((nurse) => nurse.isWorker);
    const offNurses = nurses.filter((nurse) => !nurse.isWorker);

    if (sortMode === 'manual') {
        return [...onNurses, ...offNurses];
    }

    const collator = new Intl.Collator(getLocaleForLanguage(language), {sensitivity: 'base'});
    const compareNurseName = (left: TOnboardingNurseDraft, right: TOnboardingNurseDraft) =>
        collator.compare(left.name, right.name) || left.id.localeCompare(right.id);

    return [...onNurses].sort(compareNurseName).concat([...offNurses].sort(compareNurseName));
};
