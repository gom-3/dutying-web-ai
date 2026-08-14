import type {
    TSelectableShiftClassification,
    TSelectableShiftRotationSystem,
    TSelectableWardRotationMode,
} from '@/shared/lib/shift-rotation-selection';
import {getSelectableRotationSystemsForClassification} from '@/shared/lib/shift-rotation-selection';

export type TOnboardingShiftMappingStatus = 'UNASSIGNED' | 'AUTO_MATCHED' | 'CONFIRMED';
export type TOnboardingShiftMappingRecommendationReason = 'AI' | 'NAME' | 'TIME';
export type TOnboardingShiftMapping = {
    classification: TSelectableShiftClassification;
    rotationSystem: TSelectableShiftRotationSystem;
};
export type TOnboardingShiftMappingRecommendation = TOnboardingShiftMapping & {
    reason: TOnboardingShiftMappingRecommendationReason;
};
export type TPreviousScheduleShiftMappingCandidate = {
    classification: TSelectableShiftClassification;
    isActive?: boolean;
    mappingStatus?: TOnboardingShiftMappingStatus;
    protectedByPreviousSchedule?: boolean;
    rotationSystem?: TSelectableShiftRotationSystem;
    source?: 'schedule-input' | string;
};

type TPreviousScheduleRotationModeCorrectionInput = {
    shortName: string;
    classification?: TSelectableShiftClassification | null;
    rotationSystem?: TSelectableShiftRotationSystem | null;
    rotationMode: TSelectableWardRotationMode;
};

const OFF_CODES = new Set(['O', '/', '-', 'OFF']);
const TWO_DAY_CODES = new Set(['ⓓ', 'Ⓓ']);
const TWO_NIGHT_CODES = new Set(['ⓝ', 'Ⓝ']);
const MIXED_TWO_DAY_CODE = '1';
const MIXED_TWO_NIGHT_CODE = '2';
const normalizePreviousScheduleShiftCode = (value: string) =>
    value
        .trim()
        .replace(/Ⓓ/g, 'ⓓ')
        .replace(/Ⓝ/g, 'ⓝ')
        .replace(/[a-z]/g, (character) => character.toUpperCase());

export const isAmbiguousPreviousScheduleTwoShiftCode = (value: string) => {
    const normalizedCode = normalizePreviousScheduleShiftCode(value);

    return TWO_DAY_CODES.has(normalizedCode) || TWO_NIGHT_CODES.has(normalizedCode);
};

const normalizeTime = (value?: string | null) => {
    const match = value?.trim().match(/^(\d{1,2}):([0-5]\d)(?::00)?$/);

    if (!match) return null;

    const hour = Number(match[1]);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

    return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

export function getAutomaticPreviousScheduleShiftMapping(
    shortName: string,
    rotationMode: TSelectableWardRotationMode,
): TOnboardingShiftMapping | null {
    const normalizedCode = normalizePreviousScheduleShiftCode(shortName);

    if (OFF_CODES.has(normalizedCode)) return {classification: 'OFF', rotationSystem: 'NONE'};

    // Circled D/N codes are ward-specific identifiers. Do not infer a
    // two-shift meaning from the glyph alone.
    if (isAmbiguousPreviousScheduleTwoShiftCode(normalizedCode)) return null;

    if (rotationMode === 'MIXED') {
        if (normalizedCode === MIXED_TWO_DAY_CODE) return {classification: 'DAY', rotationSystem: 'TWO'};

        if (normalizedCode === MIXED_TWO_NIGHT_CODE) return {classification: 'NIGHT', rotationSystem: 'TWO'};
    }

    if (rotationMode === 'TWO') {
        if (normalizedCode === 'D') return {classification: 'DAY', rotationSystem: 'TWO'};

        if (normalizedCode === 'N') return {classification: 'NIGHT', rotationSystem: 'TWO'};

        return null;
    }

    if (normalizedCode === 'D') return {classification: 'DAY', rotationSystem: 'THREE'};

    if (normalizedCode === 'E') return {classification: 'EVENING', rotationSystem: 'THREE'};

    if (normalizedCode === 'N') return {classification: 'NIGHT', rotationSystem: 'THREE'};

    return null;
}

/**
 * 이전 근무표가 병동에서 선택하지 않은 교대제로 분석된 경우의 보정값입니다.
 *
 * D/N처럼 현재 교대제에서도 의미가 명확한 코드는 현재 교대제의 근무로
 * 다시 매핑하고, 현재 교대제에 존재하지 않는 코드는 기타 근무로 보존합니다.
 * 이름과 시간만으로는 교대제를 확정하지 않습니다.
 */
export function getPreviousScheduleRotationModeCorrection({
    shortName,
    classification,
    rotationSystem,
    rotationMode,
}: TPreviousScheduleRotationModeCorrectionInput): TOnboardingShiftMapping | null {
    if (rotationMode === 'MIXED') return null;

    const normalizedCode = normalizePreviousScheduleShiftCode(shortName);
    const isRotatingClassification =
        classification === 'DAY' || classification === 'EVENING' || classification === 'NIGHT' || classification === 'NIGHT_CONTINUATION';
    const hasOppositeRotation =
        (rotationMode === 'THREE' && rotationSystem === 'TWO' && isRotatingClassification) ||
        (rotationMode === 'TWO' && rotationSystem === 'THREE' && isRotatingClassification);
    const hasOppositeOnlyCode =
        (rotationMode === 'THREE' && (TWO_DAY_CODES.has(normalizedCode) || TWO_NIGHT_CODES.has(normalizedCode))) ||
        (rotationMode === 'TWO' && (normalizedCode === 'E' || classification === 'EVENING'));

    if (!hasOppositeRotation && !hasOppositeOnlyCode) return null;

    return (
        getAutomaticPreviousScheduleShiftMapping(shortName, rotationMode) ?? {
            classification: 'OTHER_WORK',
            rotationSystem: 'NONE',
        }
    );
}

export function getPreviousScheduleShiftMappingRecommendation({
    shortName,
    name,
    startTime,
    endTime,
    classification,
    rotationSystem,
    rotationMode,
}: {
    shortName: string;
    name?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    classification?: TSelectableShiftClassification | null;
    rotationSystem?: TSelectableShiftRotationSystem | null;
    rotationMode: TSelectableWardRotationMode;
}): TOnboardingShiftMappingRecommendation | null {
    if (getAutomaticPreviousScheduleShiftMapping(shortName, rotationMode)) return null;

    const start = normalizeTime(startTime);
    const end = normalizeTime(endTime);

    if (rotationMode !== 'THREE') {
        if (start === '07:00' && end === '19:00') return {classification: 'DAY', rotationSystem: 'TWO', reason: 'TIME'};

        if (start === '19:00' && end === '07:00') return {classification: 'NIGHT', rotationSystem: 'TWO', reason: 'TIME'};

        const normalizedName =
            name
                ?.trim()
                .toLocaleLowerCase()
                .replace(/[\s_-]+/g, '') ?? '';
        const explicitlyNamesTwoShift = normalizedName.includes('2교대') || normalizedName.includes('twoshift');

        if (
            explicitlyNamesTwoShift &&
            (normalizedName.includes('주간') || normalizedName.includes('데이') || normalizedName.includes('day'))
        ) {
            return {classification: 'DAY', rotationSystem: 'TWO', reason: 'NAME'};
        }

        if (
            explicitlyNamesTwoShift &&
            (normalizedName.includes('야간') || normalizedName.includes('나이트') || normalizedName.includes('night'))
        ) {
            return {classification: 'NIGHT', rotationSystem: 'TWO', reason: 'NAME'};
        }
    }

    if (
        classification &&
        rotationSystem &&
        ['DAY', 'EVENING', 'NIGHT', 'NIGHT_CONTINUATION', 'OFF'].includes(classification) &&
        getSelectableRotationSystemsForClassification(rotationMode, classification).includes(rotationSystem)
    ) {
        return {classification, rotationSystem, reason: 'AI'};
    }

    return null;
}

export function isUniqueAutomaticPreviousScheduleShiftMapping(
    shiftType: TPreviousScheduleShiftMappingCandidate,
    shiftTypes: TPreviousScheduleShiftMappingCandidate[],
) {
    if (shiftType.mappingStatus !== 'AUTO_MATCHED') return false;

    // OFF aliases are consolidated to one representative code before this
    // check, so they are always safe to keep as an explicit auto-match.
    if (shiftType.classification === 'OFF' && shiftType.rotationSystem === 'NONE') return true;

    const matchingObservedShiftTypes = shiftTypes.filter(
        (candidate) =>
            candidate.isActive !== false &&
            (candidate.source === 'schedule-input' || candidate.protectedByPreviousSchedule === true) &&
            isOnboardingShiftMappingResolved(candidate.mappingStatus) &&
            candidate.classification === shiftType.classification &&
            candidate.rotationSystem === shiftType.rotationSystem,
    );

    return matchingObservedShiftTypes.length === 1;
}

export function isOnboardingShiftMappingResolved(status?: TOnboardingShiftMappingStatus) {
    return status !== 'UNASSIGNED';
}
