import {type TNurse} from '@/entities/nurse';
import {type TNurseDrawerMode, type TNurseSaveStatus} from '@/features/edit-shift-team/model/store';
import type {TI18nKey} from '@/shared/hook/use-typed-translation';
import {DEFAULT_NURSE_SHIFT_RATIO_WEIGHT, getNurseShiftTypeKey} from './nurse-shift-types';
import {getMemoWithoutRoleMarkers, hasNursePrecepteeRole, hasNursePreceptorRole} from './nurse-role';

const nurseProfileEditableKeys = ['name', 'phoneNum', 'birthDate', 'isWorker', 'isWardManager'] as const;

export function hasNurseProfileChanges(original: TNurse | null | undefined, draft: TNurse | null | undefined) {
    if (!original || !draft) return false;

    if (nurseProfileEditableKeys.some((key) => original[key] !== draft[key])) return true;

    return (
        getMemoWithoutRoleMarkers(original.memo) !== getMemoWithoutRoleMarkers(draft.memo) ||
        hasNursePreceptorRole(original) !== hasNursePreceptorRole(draft) ||
        hasNursePrecepteeRole(original) !== hasNursePrecepteeRole(draft)
    );
}

export function hasNurseChanges(original: TNurse | null | undefined, draft: TNurse | null | undefined) {
    if (!original || !draft) return false;

    if (hasNurseProfileChanges(original, draft)) return true;

    const originalShiftTypeByKey = new Map(original.nurseShiftTypes.map((shiftType) => [getNurseShiftTypeKey(shiftType), shiftType]));
    const draftShiftTypeByKey = new Map(draft.nurseShiftTypes.map((shiftType) => [getNurseShiftTypeKey(shiftType), shiftType]));
    const hasDraftShiftTypeChanges = draft.nurseShiftTypes.some((shiftType) => {
        const originalIsPossible = originalShiftTypeByKey.get(getNurseShiftTypeKey(shiftType))?.isPossible ?? true;
        const originalTargetRatioWeight =
            originalShiftTypeByKey.get(getNurseShiftTypeKey(shiftType))?.targetRatioWeight ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;
        const draftTargetRatioWeight = shiftType.targetRatioWeight ?? DEFAULT_NURSE_SHIFT_RATIO_WEIGHT;

        return originalIsPossible !== shiftType.isPossible || originalTargetRatioWeight !== draftTargetRatioWeight;
    });

    if (hasDraftShiftTypeChanges) return true;

    return original.nurseShiftTypes.some((shiftType) => !draftShiftTypeByKey.has(getNurseShiftTypeKey(shiftType)));
}

export function getNurseDrawerFeedback(params: {mode: TNurseDrawerMode; saveStatus: TNurseSaveStatus; isDirty: boolean}): {
    titleKey: TI18nKey;
    descriptionKey: TI18nKey;
    toneClassName: string;
} {
    const {mode, saveStatus, isDirty} = params;

    if (saveStatus === 'saving') {
        return {
            titleKey: 'page.member.nurseDrawerFeedback.saving.title',
            descriptionKey: 'page.member.nurseDrawerFeedback.saving.description',
            toneClassName: 'border-main-3 bg-main-light text-main-1',
        };
    }

    if (saveStatus === 'error') {
        return {
            titleKey: 'page.member.nurseDrawerFeedback.error.title',
            descriptionKey: 'page.member.nurseDrawerFeedback.error.description',
            toneClassName: 'border-red/30 bg-red/5 text-red',
        };
    }

    if (saveStatus === 'success' && !isDirty) {
        return {
            titleKey: 'page.member.nurseDrawerFeedback.success.title',
            descriptionKey: 'page.member.nurseDrawerFeedback.success.description',
            toneClassName: 'border-main-2/20 bg-main-4 text-main-1',
        };
    }

    if (mode === 'create') {
        return {
            titleKey: 'page.member.nurseDrawerFeedback.create.title',
            descriptionKey: 'page.member.nurseDrawerFeedback.create.description',
            toneClassName: 'border-main-3/60 bg-sub-5 text-sub-1',
        };
    }

    if (isDirty) {
        return {
            titleKey: 'page.member.nurseDrawerFeedback.dirty.title',
            descriptionKey: 'page.member.nurseDrawerFeedback.dirty.description',
            toneClassName: 'border-sub-4 bg-main-bg text-sub-1',
        };
    }

    return {
        titleKey: 'page.member.nurseDrawerFeedback.idle.title',
        descriptionKey: 'page.member.nurseDrawerFeedback.idle.description',
        toneClassName: 'border-sub-4 bg-main-bg text-sub-2',
    };
}
