import type {TOnboardingNurseDraft} from './draft';
import type {TSortMode} from './types';

const compareNurseName = (left: TOnboardingNurseDraft, right: TOnboardingNurseDraft) => {
    const byName = left.name.localeCompare(right.name, 'ko-KR', {sensitivity: 'base'});

    if (byName !== 0) {
        return byName;
    }

    return left.id.localeCompare(right.id);
};
export const sortNursesByMode = (nurses: TOnboardingNurseDraft[], sortMode: TSortMode): TOnboardingNurseDraft[] => {
    const onNurses = nurses.filter((nurse) => nurse.isWorker);
    const offNurses = nurses.filter((nurse) => !nurse.isWorker);

    if (sortMode === 'manual') {
        return [...onNurses, ...offNurses];
    }

    return [...onNurses].sort(compareNurseName).concat([...offNurses].sort(compareNurseName));
};
