import type {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getRequiredRotationClassifications, getSelectableRotationSystemsForClassification} from '@/shared/lib/shift-rotation-selection';
import {hasInvalidShiftShortNameLengthInput} from '@/shared/lib/shift-short-name';
import {
    isOnboardingShiftMappingResolved,
    isOnboardingShiftTypeActive,
    resolveOnboardingRotationSystem,
    type TOnboardingRotationMode,
    type TOnboardingValidationIssue,
    type TOnboardingWardShiftType,
} from '../model';

type TTranslate = ReturnType<typeof useTypedTranslation>['t'];

const getSelectedRotationSystem = (shiftType: TOnboardingWardShiftType) =>
    shiftType.classification === 'OFF' ||
    shiftType.classification === 'OTHER_WORK' ||
    shiftType.classification === 'ANNUAL_LEAVE' ||
    shiftType.classification === 'OTHER_LEAVE'
        ? 'NONE'
        : (shiftType.rotationSystem ?? resolveOnboardingRotationSystem(shiftType));

export function getShiftDuplicateError(
    shiftType: TOnboardingWardShiftType,
    shiftTypes: TOnboardingWardShiftType[],
    rotationMode: TOnboardingRotationMode,
    t: TTranslate,
) {
    if (!isOnboardingShiftTypeActive(shiftType) || !isOnboardingShiftMappingResolved(shiftType.mappingStatus)) return null;

    const rotationSystem = getSelectedRotationSystem(shiftType);
    const requiredType = getRequiredRotationClassifications(rotationMode, {includeNightContinuation: true}).find(
        (required) =>
            required.classification === shiftType.classification &&
            (rotationMode !== 'MIXED' || required.rotationSystem === rotationSystem),
    );

    if (!requiredType || requiredType.classification === 'ANNUAL_LEAVE') return null;

    const duplicates = shiftTypes.filter(
        (candidate) =>
            isOnboardingShiftTypeActive(candidate) &&
            isOnboardingShiftMappingResolved(candidate.mappingStatus) &&
            candidate.classification === shiftType.classification &&
            (rotationMode !== 'MIXED' || getSelectedRotationSystem(candidate) === rotationSystem),
    );

    if (duplicates.length < 2) return null;

    const labelKeys = {
        DAY: 'page.onboardingWardCreate.shiftType.classification.day',
        EVENING: 'page.onboardingWardCreate.shiftType.classification.evening',
        NIGHT: 'page.onboardingWardCreate.shiftType.classification.night',
        NIGHT_CONTINUATION: 'page.onboardingWardCreate.shiftType.classification.nightContinuation',
        OFF: 'page.onboardingWardCreate.shiftType.classification.off',
    } as const;
    const classification = t(labelKeys[requiredType.classification]);
    const label =
        rotationMode === 'MIXED' && rotationSystem !== 'NONE'
            ? `${t(rotationSystem === 'TWO' ? 'page.onboardingWardCreate.shiftType.rotationTwo' : 'page.onboardingWardCreate.shiftType.rotationThree')} ${classification}`
            : classification;

    return t('page.onboardingWardCreate.shiftType.validation.duplicateClassification', {
        shiftType: label,
        shiftCodes: duplicates.map((shift) => shift.shortName.trim() || shift.name.trim() || '-').join(' · '),
    });
}

export function getShiftRotationError(shiftType: TOnboardingWardShiftType, rotationMode: TOnboardingRotationMode, t: TTranslate) {
    if (!isOnboardingShiftMappingResolved(shiftType.mappingStatus)) return null;

    const rotationSystem = getSelectedRotationSystem(shiftType);

    if (getSelectableRotationSystemsForClassification(rotationMode, shiftType.classification).includes(rotationSystem)) return null;

    const rotationLabel = (rotation: string) =>
        t(
            rotation === 'THREE'
                ? 'page.onboardingWardCreate.shiftType.rotationThree'
                : rotation === 'TWO'
                  ? 'page.onboardingWardCreate.shiftType.rotationTwo'
                  : rotation === 'MIXED'
                    ? 'page.onboardingWardCreate.shiftType.rotationMixed'
                    : 'page.onboardingWardCreate.shiftType.rotationNone',
        );

    return t('page.onboardingWardCreate.shiftType.validation.rotationMismatch', {
        shiftRotation: rotationLabel(rotationSystem),
        wardRotation: rotationLabel(rotationMode),
    });
}

export function getShiftClassificationError(
    shiftType: TOnboardingWardShiftType,
    shiftTypes: TOnboardingWardShiftType[],
    rotationMode: TOnboardingRotationMode,
    t: TTranslate,
) {
    return getShiftDuplicateError(shiftType, shiftTypes, rotationMode, t) ?? getShiftRotationError(shiftType, rotationMode, t);
}

export function getShiftTypeIssueMessage(
    issue: TOnboardingValidationIssue,
    shiftTypes: TOnboardingWardShiftType[],
    rotationMode: TOnboardingRotationMode,
    t: TTranslate,
) {
    if (issue.code === 'duplicate-required-shift-types') {
        return shiftTypes.map((shiftType) => getShiftDuplicateError(shiftType, shiftTypes, rotationMode, t)).find(Boolean) ?? null;
    }

    const shiftType = shiftTypes.find((shift) => shift.id === issue.targetId);

    if (issue.step !== 4 || !shiftType) return null;

    let reason: string;

    switch (issue.code) {
        case 'invalid-shift-rotation':
            reason =
                getShiftClassificationError(shiftType, shiftTypes, rotationMode, t) ??
                t('page.onboardingWardCreate.blocked.invalidShiftType');
            break;
        case 'unmapped-shift-type':
            reason = t('page.onboardingWardCreate.shiftType.reviewHint');
            break;
        case 'missing-shift-name':
            reason = t('page.onboardingWardCreate.shiftType.validation.nameRequired');
            break;
        case 'invalid-shift-name':
            reason = t('page.onboardingWardCreate.shiftType.validation.nameLength');
            break;
        case 'missing-shift-short-name':
            reason = t('page.onboardingWardCreate.shiftType.validation.shortNameRequired');
            break;
        case 'invalid-shift-short-name':
            reason = t(
                hasInvalidShiftShortNameLengthInput(shiftType.shortName)
                    ? 'page.onboardingWardCreate.shiftType.validation.shortNameLength'
                    : 'page.onboardingWardCreate.shiftType.validation.shortNameFirstKey',
            );
            break;
        case 'duplicate-shift-short-name':
            reason = t('page.onboardingWardCreate.shiftType.validation.shortNameDuplicate');
            break;
        case 'missing-shift-time':
            reason = t('page.onboardingWardCreate.shiftType.validation.timeRequired');
            break;
        case 'invalid-shift-time-format':
            reason = t('page.onboardingWardCreate.shiftType.validation.timeFormat');
            break;
        case 'invalid-shift-time-order':
            reason = t('page.onboardingWardCreate.shiftType.validation.timeOrder');
            break;
        default:
            return null;
    }

    const name = shiftType.name.trim();
    const code = shiftType.shortName.trim();
    const shift =
        name && code && name !== code
            ? `${name} (${code})`
            : name || code || t('page.onboardingWardCreate.shiftType.validation.unnamedShift', {index: shiftTypes.indexOf(shiftType) + 1});

    return t('page.onboardingWardCreate.shiftType.validation.shiftIssue', {shift, reason});
}

export function focusShiftTypeIssue(issue?: TOnboardingValidationIssue) {
    const row = issue?.targetId ? document.getElementById(`onboarding-shift-row-${issue.targetId}`) : null;
    const field =
        issue?.code === 'missing-shift-name' || issue?.code === 'invalid-shift-name'
            ? 'name'
            : issue?.code.includes('short-name')
              ? 'code'
              : issue?.code.includes('time')
                ? 'time'
                : 'classification';
    const target =
        row?.querySelector<HTMLElement>(`[data-shift-field="${field}"] input, [data-shift-field="${field}"] [role="combobox"]`) ?? row;
    const focusTarget =
        target ??
        (issue?.code === 'duplicate-required-shift-types'
            ? document.querySelector<HTMLElement>('[data-shift-field="classification"] [aria-invalid="true"]')
            : null) ??
        document.getElementById('required-shift-types');

    focusTarget?.scrollIntoView?.({block: 'center'});
    focusTarget?.focus({preventScroll: true});
}
