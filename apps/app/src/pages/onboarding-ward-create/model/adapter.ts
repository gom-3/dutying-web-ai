import {type TCreateWardDTO, type TShiftConstraintSeverity} from '@dutying/api/ward';
import {v4 as uuidv4} from 'uuid';
import {type TOnboardingWardParseApiResponse, type TOnboardingWardParseOptions} from '@/shared/api/file/type';
import {getDefaultTimeRangeForRotation, isRestShiftOption} from '@/shared/lib/shift-rotation-selection';
import {normalizeOnboardingDivisions} from './divisions';
import {
    assignImportedShiftColors,
    createEmptyShiftType,
    ensureOnboardingAnnualLeave,
    DEFAULT_OFF_SHIFT_TYPE_COLOR,
    getDefaultTeamName,
    getDivisionFallbackLabel,
    DEFAULT_ONBOARDING_DIVISION_NUM,
    getAvailableOnboardingShiftColor,
    getDefaultShiftTypeColor,
    getShiftTypesForNewUpload,
    isOnboardingShiftTypeActive,
    normalizeOnboardingShiftCode,
    normalizeNurseNameForRequest,
    orderOnboardingShiftTypes,
    resolveOnboardingRotationSystem,
    type TOnboardingConstraintDraft,
    type TOnboardingDraftLabels,
    type TOnboardingNurseDraft,
    type TOnboardingRotationMode,
    type TOnboardingTeamDraft,
    type TOnboardingUploadedMonthlySchedule,
    type TOnboardingUploadedTeamSchedule,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
} from './draft';
import {createScheduleShiftTypeResolver} from './schedule-shift-reference';
import {
    getAutomaticPreviousScheduleShiftMapping,
    getPreviousScheduleShiftMappingRecommendation,
    getPreviousScheduleRotationModeCorrection,
    isAmbiguousPreviousScheduleTwoShiftCode,
    isUniqueAutomaticPreviousScheduleShiftMapping,
    isOnboardingShiftMappingResolved,
    type TOnboardingShiftMappingRecommendation,
    type TOnboardingShiftMappingStatus,
} from './shift-type-mapping';
import {buildOnboardingWardIdentityPayload} from './ward-identity';

export type TOnboardingParsedShiftType = Partial<Omit<TCreateWardDTO['wardShiftTypes'][number], 'isCounted'>> & {
    name?: string;
    shortName?: string;
    source?: TOnboardingWardShiftType['source'];
    protectedByPreviousSchedule?: boolean;
    autoSeeded?: boolean;
    mappingStatus?: TOnboardingShiftMappingStatus;
    mappingRecommendation?: TOnboardingShiftMappingRecommendation;
    shortNameAliases?: string[];
};

export type TOnboardingParsedTeamDivision = {
    divisionNum: number;
    name: string;
};

export type TOnboardingParsedTeam = {
    name: string;
    divisions?: TOnboardingParsedTeamDivision[];
};

export type TOnboardingParsedInitialShift = {
    date: string;
    shiftShortName: string;
};

export type TOnboardingParsedNurse = Partial<
    Pick<TOnboardingNurseDraft, 'name' | 'memo' | 'isWorker' | 'employmentDate' | 'isPreceptor' | 'isPreceptee' | 'divisionNum'>
> & {
    teamName?: string;
    groupName?: string;
    possibleShiftShortNames?: string[];
    initialShifts?: TOnboardingParsedInitialShift[];
};

export type TOnboardingParsedConstraintCandidate = Omit<TOnboardingConstraintDraft, 'id'>;

export type TOnboardingParsedWardData = {
    importedCodes?: string[];
    fileName?: string;
    wardName?: string;
    hospitalName?: string;
    shiftTypes?: TOnboardingParsedShiftType[];
    teams?: TOnboardingParsedTeam[];
    nurses?: TOnboardingParsedNurse[];
    constraintCandidates?: TOnboardingParsedConstraintCandidate[];
};

export type TOnboardingParseDraftInjection = {
    parsedWardData: TOnboardingParsedWardData;
    warnings: string[];
};
export type TOnboardingParseWarningCopy = {
    failedSheet: (sheetName: string) => string;
    failedRow: (rowLabel: string) => string;
};
export type TOnboardingUploadFailureCopy = {
    defaultMessage: string;
    networkMessage: string;
};

export {
    getOnboardingUploadExtension,
    isOnboardingImageFile,
    isSupportedOnboardingUploadFile,
    ONBOARDING_UPLOAD_ACCEPT,
} from '@/shared/api/file/onboarding-format';

const SUPPORTED_CONSTRAINT_TEMPLATE_CODES = new Set([
    'MIN_STAFF_BY_SHIFT',
    'MAX_CONSECUTIVE_WORK_DAYS',
    'MAX_CONSECUTIVE_N',
    'MIN_OFF_AFTER_N',
    'FORBID_N_THEN_D',
    'FORBID_N_THEN_E',
    'FORBID_E_THEN_D',
]);
const DEFAULT_CONSTRAINT_SEVERITY: TShiftConstraintSeverity = 'SOFT';
const HARD_AFTER_CONFIRM = 'HARD_AFTER_CONFIRM';
const CORE_SHIFT_SHORT_NAMES = ['D', 'E', 'N', 'O'] as const;
const SHIFT_CODE_LABELS: Record<string, string> = {
    D: '\uB370\uC774',
    E: '\uC774\uBE0C\uB2DD',
    N: '\uB098\uC774\uD2B8',
    O: '\uC624\uD504',
};
const DAY_SHIFT_SHORT_NAME_ALIASES = new Set(['D', 'DAY', 'DA', '\uB370\uC774']);
const EVENING_SHIFT_SHORT_NAME_ALIASES = new Set(['E', 'EV', 'EVENING', '\uC774\uBE0C', '\uC774\uBE0C\uB2DD']);
const NIGHT_SHIFT_SHORT_NAME_ALIASES = new Set(['N', 'NIGHT', '\uB098\uC774\uD2B8']);
const ANNUAL_LEAVE_SHIFT_SHORT_NAME_ALIASES = new Set(['\uC5F0\uCC28']);
const OFF_SHIFT_SHORT_NAME_ALIASES = new Set([
    'O',
    'OFF',
    '/',
    '-',
    '\uC624\uD504',
    '\uD734',
    '\uD734\uBB34',
    '\u4F11',
    '\u4F11\u307F',
    '\u4F11\u65E5',
    '\u516C\u4F11',
]);
const PLACEHOLDER_CUSTOM_SHIFT_COLORS = new Set(['#94A3B8', '#BFC7D4']);
const DEFAULT_WARD_FALLBACK_NAME = '\uB4C0\uD305 \uBCD1\uB3D9';
const PRECEPTOR_MEMO = '\uD504\uB9AC\uC149\uD130';
const PRECEPTEE_MEMO = '\uD504\uB9AC\uC149\uD2F0';
const DEFAULT_PARSE_WARNING_COPY: TOnboardingParseWarningCopy = {
    failedSheet: (sheetName) => `\uC2DC\uD2B8 "${sheetName}" \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.`,
    failedRow: (rowLabel) => `\uC77C\uBD80 \uD589(${rowLabel})\uC744 \uD574\uC11D\uD558\uC9C0 \uBABB\uD574 \uC81C\uC678\uD588\uC5B4\uC694.`,
};
const DEFAULT_UPLOAD_FAILURE_COPY: TOnboardingUploadFailureCopy = {
    defaultMessage:
        '\uD30C\uC77C\uC744 \uD574\uC11D\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC5D1\uC140 \uC591\uC2DD\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC5C5\uB85C\uB4DC\uD574 \uC8FC\uC138\uC694.',
    networkMessage:
        '\uD30C\uC2F1 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
};
const getNurseRoleFlagsFromMemo = (memo: string | null | undefined) => {
    const trimmedMemo = memo?.trim();
    const isPreceptor = trimmedMemo === PRECEPTOR_MEMO;
    const isPreceptee = trimmedMemo === PRECEPTEE_MEMO;

    return {isPreceptor, isPreceptee};
};
const getMemoWithoutNurseRoleMarker = (memo: string | null | undefined) => {
    const trimmedMemo = memo?.trim();

    return trimmedMemo === PRECEPTOR_MEMO || trimmedMemo === PRECEPTEE_MEMO ? '' : (memo ?? '');
};
const VALID_SHIFT_CLASSIFICATIONS = new Set<TOnboardingWardShiftType['classification']>([
    'DAY',
    'EVENING',
    'NIGHT',
    'NIGHT_CONTINUATION',
    'OTHER_WORK',
    'OFF',
    'ANNUAL_LEAVE',
    'OTHER_LEAVE',
]);
const createLocalId = (prefix: string) => `${prefix}-${uuidv4()}`;
const getPayloadShiftClassification = (
    shiftType: TCreateWardDTO['wardShiftTypes'][number],
): TCreateWardDTO['wardShiftTypes'][number]['classification'] => {
    if (shiftType.isOff) {
        if (shiftType.classification === 'OFF' || isOffShiftShortName(shiftType.shortName)) return 'OFF';

        if (shiftType.classification === 'ANNUAL_LEAVE') return 'ANNUAL_LEAVE';

        return 'OTHER_LEAVE';
    }

    if (shiftType.classification === 'OFF' || shiftType.classification === 'ANNUAL_LEAVE' || shiftType.classification === 'OTHER_LEAVE') {
        return 'OTHER_WORK';
    }

    return shiftType.classification;
};
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const trimToUndefined = (value?: string | null) => {
    const trimmed = value?.trim();

    return trimmed ?? undefined;
};
const formatMonthDate = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const isValidIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);

    return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const normalizeAssignmentDate = (rawDate: string, options?: TOnboardingWardParseOptions): string | null => {
    const dateKey = rawDate.trim();

    if (!dateKey) {
        return null;
    }

    if (isValidIsoDate(dateKey)) {
        return dateKey;
    }

    const day = /^\d{1,2}$/.test(dateKey) ? Number.parseInt(dateKey, 10) : Number.NaN;

    if (
        options?.targetYear &&
        options?.targetMonth &&
        Number.isInteger(day) &&
        day >= 1 &&
        day <= new Date(options.targetYear, options.targetMonth, 0).getDate()
    ) {
        return formatMonthDate(options.targetYear, options.targetMonth, day);
    }

    return null;
};
const normalizeInitialShifts = (
    assignments?: Record<string, string | null> | null,
    options?: TOnboardingWardParseOptions,
): TOnboardingParsedInitialShift[] => {
    const initialShifts = Object.entries(assignments ?? {})
        .map(([rawDate, rawShiftShortName]) => {
            const date = normalizeAssignmentDate(rawDate, options);
            const shiftShortName = normalizeShiftShortName(rawShiftShortName);

            return date && shiftShortName ? {date, shiftShortName} : null;
        })
        .filter((shift): shift is TOnboardingParsedInitialShift => Boolean(shift));

    initialShifts.sort((left, right) => left.date.localeCompare(right.date));

    return initialShifts;
};

type TPhotoAssignments = Record<string, string | null> | null | undefined;

const getRawPhotoAssignments = (values: TPhotoAssignments, options?: TOnboardingWardParseOptions) => {
    const result = new Map<string, string>();

    for (const [key, value] of Object.entries(values ?? {})) {
        const date = normalizeAssignmentDate(key, options);

        if (date && typeof value === 'string' && value.trim()) result.set(date, value.trim());
    }

    return result;
};
const getImportedInitialShifts = (
    assignments: TPhotoAssignments,
    rawAssignments: TPhotoAssignments,
    options: TOnboardingWardParseOptions | undefined,
    aliases: Map<string, string>,
) => {
    const shifts = new Map(
        normalizeInitialShifts(assignments, options).map(({date, shiftShortName}) => [date, aliases.get(shiftShortName) ?? shiftShortName]),
    );

    for (const [date, rawCode] of getRawPhotoAssignments(rawAssignments, options)) shifts.set(date, rawCode);

    return Array.from(shifts, ([date, shiftShortName]) => ({date, shiftShortName})).sort((a, b) => a.date.localeCompare(b.date));
};
const compactParsedNurse = (nurse: TOnboardingParsedNurse): TOnboardingParsedNurse =>
    Object.fromEntries(
        Object.entries(nurse).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0)),
    ) as TOnboardingParsedNurse;
const requireFirstTeamId = (teams: TOnboardingTeamDraft[]) => {
    const firstTeamId = teams[0]?.id;

    if (!firstTeamId) {
        throw new Error('Onboarding draft invariant violated: empty-team');
    }

    return firstTeamId;
};
const isOffShiftShortName = (shortName: string) => OFF_SHIFT_SHORT_NAME_ALIASES.has(shortName.toUpperCase());
const inferClassificationFromShortName = (shortName: string, isOff: boolean): TOnboardingWardShiftType['classification'] => {
    if (isOff) return 'OFF';

    const normalizedShortName = shortName.toUpperCase();

    if (DAY_SHIFT_SHORT_NAME_ALIASES.has(normalizedShortName)) return 'DAY';

    if (EVENING_SHIFT_SHORT_NAME_ALIASES.has(normalizedShortName)) return 'EVENING';

    if (NIGHT_SHIFT_SHORT_NAME_ALIASES.has(normalizedShortName)) return 'NIGHT';

    if (ANNUAL_LEAVE_SHIFT_SHORT_NAME_ALIASES.has(normalizedShortName)) return 'ANNUAL_LEAVE';

    if (OFF_SHIFT_SHORT_NAME_ALIASES.has(normalizedShortName)) return 'OFF';

    return 'OTHER_WORK';
};
const normalizeShiftClassification = (
    classification: string | null | undefined,
    shortName: string,
): TOnboardingWardShiftType['classification'] => {
    const normalizedClassification = classification?.trim().toUpperCase();

    if (
        normalizedClassification &&
        VALID_SHIFT_CLASSIFICATIONS.has(normalizedClassification as TOnboardingWardShiftType['classification'])
    ) {
        return normalizedClassification as TOnboardingWardShiftType['classification'];
    }

    return inferClassificationFromShortName(shortName, isOffShiftShortName(shortName));
};
const normalizeShiftShortName = (value?: string | null) => {
    const trimmed = trimToUndefined(value);

    return trimmed ? normalizeOnboardingShiftCode(trimmed) : undefined;
};
const normalizeColorKey = (color?: string | null) => color?.trim().toUpperCase();
const isCoreShiftShortName = (shortName?: string) => CORE_SHIFT_SHORT_NAMES.includes(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number]);
const shouldReassignCustomShiftColor = (color: string | undefined, usedColors: Set<string>) => {
    if (!color) {
        return true;
    }

    return PLACEHOLDER_CUSTOM_SHIFT_COLORS.has(color) || usedColors.has(color);
};
const collectObservedWorkShiftCodes = (
    assignments?: Record<string, string | null> | null,
    monthlyCounts?: Record<string, number | null> | null,
) => {
    const shiftCodes = new Set<string>();

    Object.values(assignments ?? {}).forEach((code) => {
        const normalizedCode = normalizeShiftShortName(code);

        if (normalizedCode && !isOffShiftShortName(normalizedCode)) {
            shiftCodes.add(normalizedCode);
        }
    });

    Object.entries(monthlyCounts ?? {}).forEach(([code, count]) => {
        const normalizedCode = normalizeShiftShortName(code);

        if (normalizedCode && !isOffShiftShortName(normalizedCode) && (count ?? 0) > 0) {
            shiftCodes.add(normalizedCode);
        }
    });

    return Array.from(shiftCodes);
};
const normalizeUploadedShiftTypes = (shiftTypes: TOnboardingWardShiftType[]): TOnboardingWardShiftType[] =>
    shiftTypes.map((shiftType) =>
        isOnboardingShiftMappingResolved(shiftType.mappingStatus)
            ? {...shiftType, rotationSystem: resolveOnboardingRotationSystem(shiftType)}
            : shiftType,
    );
const getShiftTypeNameFromShortName = (shortName: string) => SHIFT_CODE_LABELS[shortName.toUpperCase()] ?? shortName;
const createCoreParsedShiftType = (shortName: (typeof CORE_SHIFT_SHORT_NAMES)[number]): TOnboardingParsedShiftType => ({
    name: getShiftTypeNameFromShortName(shortName),
    shortName,
    isDefault: true,
    isOff: shortName === 'O',
    classification: inferClassificationFromShortName(shortName, shortName === 'O'),
    source: 'schedule-input',
});
const toDraftShiftType = (
    parsed: TOnboardingParsedShiftType,
    colorIndex = 0,
    rotationMode: TOnboardingRotationMode = 'THREE',
): TOnboardingWardShiftType => {
    const base = createEmptyShiftType(colorIndex);
    const shortName = parsed.shortName ?? base.shortName;
    const automaticMapping = parsed.source === 'schedule-input' ? getAutomaticPreviousScheduleShiftMapping(shortName, rotationMode) : null;
    const hasExplicitUserMapping = parsed.autoSeeded === false && parsed.mappingStatus === 'CONFIRMED';
    const shouldTreatAsPreviousScheduleOtherWork =
        parsed.source === 'schedule-input' && isAmbiguousPreviousScheduleTwoShiftCode(shortName) && !hasExplicitUserMapping;
    const rotationModeCorrection = shouldTreatAsPreviousScheduleOtherWork
        ? ({classification: 'OTHER_WORK', rotationSystem: 'NONE'} as const)
        : parsed.source === 'schedule-input' || parsed.protectedByPreviousSchedule === true || parsed.autoSeeded === true
          ? getPreviousScheduleRotationModeCorrection({
                shortName,
                classification: parsed.classification,
                rotationSystem: parsed.rotationSystem,
                rotationMode,
            })
          : null;
    const requestedMappingStatus =
        rotationModeCorrection != null
            ? rotationModeCorrection.rotationSystem === 'NONE'
                ? 'CONFIRMED'
                : 'AUTO_MATCHED'
            : (parsed.mappingStatus ??
              (parsed.classification === 'ANNUAL_LEAVE'
                  ? 'CONFIRMED'
                  : parsed.source === 'schedule-input'
                    ? automaticMapping
                        ? 'AUTO_MATCHED'
                        : 'UNASSIGNED'
                    : 'CONFIRMED'));
    const resolvedAutomaticMapping =
        rotationModeCorrection && rotationModeCorrection.rotationSystem !== 'NONE' ? rotationModeCorrection : automaticMapping;
    const mappingStatus = requestedMappingStatus === 'AUTO_MATCHED' && !resolvedAutomaticMapping ? 'UNASSIGNED' : requestedMappingStatus;
    const isResolved = isOnboardingShiftMappingResolved(mappingStatus);
    const classification =
        rotationModeCorrection != null
            ? rotationModeCorrection.classification
            : mappingStatus === 'AUTO_MATCHED'
              ? (automaticMapping?.classification ?? 'OTHER_WORK')
              : mappingStatus === 'UNASSIGNED'
                ? 'OTHER_WORK'
                : (parsed.classification ?? inferClassificationFromShortName(shortName, parsed.isOff ?? false));
    const isOff = isResolved && (classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE');
    const isNightContinuation = classification === 'NIGHT_CONTINUATION';
    const rotationSystem =
        rotationModeCorrection != null
            ? rotationModeCorrection.rotationSystem
            : mappingStatus === 'AUTO_MATCHED'
              ? (automaticMapping?.rotationSystem ?? 'NONE')
              : mappingStatus === 'UNASSIGNED'
                ? 'NONE'
                : resolveOnboardingRotationSystem({
                      classification,
                      isDefault: parsed.isDefault ?? false,
                      isOff,
                      rotationSystem: parsed.rotationSystem,
                  });
    const automaticTimeRange = mappingStatus === 'AUTO_MATCHED' ? getDefaultTimeRangeForRotation(rotationSystem, classification) : null;
    const mappingRecommendation =
        mappingStatus === 'UNASSIGNED'
            ? (parsed.mappingRecommendation ??
              getPreviousScheduleShiftMappingRecommendation({
                  shortName,
                  name: parsed.name,
                  startTime: parsed.startTime,
                  endTime: parsed.endTime,
                  classification: parsed.classification,
                  rotationSystem: parsed.rotationSystem,
                  rotationMode,
              }) ??
              undefined)
            : undefined;
    const parsedColor = parsed.color?.trim() ?? '';
    const isAutomaticOffColor = !parsedColor || PLACEHOLDER_CUSTOM_SHIFT_COLORS.has(parsedColor.toUpperCase());
    const defaultColor =
        classification === 'OFF' && isAutomaticOffColor
            ? DEFAULT_OFF_SHIFT_TYPE_COLOR
            : parsedColor || getDefaultShiftTypeColor(shortName, colorIndex);

    return {
        ...base,
        id: createLocalId('shift'),
        name: shouldTreatAsPreviousScheduleOtherWork
            ? shortName
            : (trimToUndefined(parsed.name) ?? getShiftTypeNameFromShortName(shortName)),
        shortName,
        startTime:
            shouldTreatAsPreviousScheduleOtherWork || isOff
                ? ''
                : (automaticTimeRange?.startTime ?? parsed.startTime ?? (mappingStatus === 'UNASSIGNED' ? '' : base.startTime)),
        endTime:
            shouldTreatAsPreviousScheduleOtherWork || isOff
                ? ''
                : (automaticTimeRange?.endTime ?? parsed.endTime ?? (mappingStatus === 'UNASSIGNED' ? '' : base.endTime)),
        color: defaultColor,
        isDefault: shouldTreatAsPreviousScheduleOtherWork ? false : classification === 'OFF' ? true : (parsed.isDefault ?? false),
        isOff,
        isCounted: isOff || isNightContinuation ? false : base.isCounted,
        classification,
        rotationSystem,
        paidMinutes: shouldTreatAsPreviousScheduleOtherWork
            ? null
            : isOff
              ? null
              : isNightContinuation
                ? 0
                : (parsed.paidMinutes ?? (rotationSystem === 'TWO' ? 630 : null)),
        source: parsed.source,
        protectedByPreviousSchedule: parsed.protectedByPreviousSchedule,
        autoSeeded: shouldTreatAsPreviousScheduleOtherWork ? false : parsed.autoSeeded,
        mappingStatus,
        mappingRecommendation,
        shortNameAliases: parsed.shortNameAliases,
    };
};
const ensureCoreShiftTypes = (
    draftShiftTypes: TOnboardingWardShiftType[],
    parsedShiftTypes: TOnboardingParsedShiftType[],
    rotationMode: TOnboardingRotationMode,
): TOnboardingWardShiftType[] => {
    if (parsedShiftTypes.length === 0) {
        return normalizeUploadedShiftTypes(draftShiftTypes);
    }

    // An uploaded A may mean any duty; the new annual-leave seed must not override it.
    draftShiftTypes = draftShiftTypes.filter(
        (shiftType) =>
            !(
                shiftType.autoSeeded === true &&
                shiftType.classification === 'ANNUAL_LEAVE' &&
                !shiftType.protectedByPreviousSchedule &&
                !parsedShiftTypes.some(
                    (parsed) =>
                        parsed.autoSeeded === true &&
                        parsed.source !== 'schedule-input' &&
                        normalizeShiftShortName(parsed.shortName) === normalizeShiftShortName(shiftType.shortName),
                )
            ),
    );

    const parsedByShortName = new Map(
        parsedShiftTypes
            .map((shiftType) => [normalizeShiftShortName(shiftType.shortName), shiftType] as const)
            .filter((entry): entry is [string, TOnboardingParsedShiftType] => Boolean(entry[0])),
    );
    const draftShortNames = new Set(draftShiftTypes.map((shiftType) => normalizeShiftShortName(shiftType.shortName)).filter(Boolean));
    const combinedShiftTypes: TOnboardingParsedShiftType[] = [
        ...draftShiftTypes.flatMap((draftShiftType) => {
            const shortName = normalizeShiftShortName(draftShiftType.shortName) ?? '';
            const parsedShiftType = parsedByShortName.get(shortName);
            const isObservedAutoSeed = draftShiftType.autoSeeded === true && parsedShiftType?.source === 'schedule-input';
            const isUnobservedAutoSeed =
                draftShiftType.autoSeeded === true &&
                draftShiftType.source !== 'schedule-input' &&
                draftShiftType.protectedByPreviousSchedule !== true &&
                !parsedShiftType;

            if (isUnobservedAutoSeed) {
                return [];
            }

            return [
                {
                    ...parsedShiftType,
                    ...draftShiftType,
                    source: parsedShiftType?.source ?? draftShiftType.source,
                    mappingStatus: isObservedAutoSeed ? undefined : draftShiftType.mappingStatus,
                    protectedByPreviousSchedule:
                        draftShiftType.protectedByPreviousSchedule === true || parsedShiftType?.source === 'schedule-input'
                            ? true
                            : undefined,
                },
            ];
        }),
        ...parsedShiftTypes
            .filter((shiftType) => !draftShortNames.has(normalizeShiftShortName(shiftType.shortName)))
            .map((shiftType) => ({...shiftType, source: shiftType.source ?? ('schedule-input' as const)})),
    ];
    const usedShortNames = new Set<string>();
    const nextShiftTypes: TOnboardingWardShiftType[] = [];

    combinedShiftTypes.forEach((shiftType) => {
        const shortName = normalizeShiftShortName(shiftType.shortName);

        if (!shortName || usedShortNames.has(shortName)) {
            return;
        }

        const staleAutoSeedCorrection =
            shiftType.autoSeeded === true && shiftType.source !== 'schedule-input' && shiftType.protectedByPreviousSchedule !== true
                ? getPreviousScheduleRotationModeCorrection({
                      shortName,
                      classification: shiftType.classification,
                      rotationSystem: shiftType.rotationSystem,
                      rotationMode,
                  })
                : null;

        // 선택한 교대제와 무관하고 이전 근무표에서도 쓰이지 않은 옛 기본
        // 시드는 가져오기 병합 대상이 아니다. 실제 표에서 관찰된 행만 기타
        // 근무로 보존한다.
        if (staleAutoSeedCorrection?.classification === 'OTHER_WORK') {
            return;
        }

        usedShortNames.add(shortName);

        const nextShiftType = toDraftShiftType(
            {
                ...shiftType,
                name: shiftType.name ?? getShiftTypeNameFromShortName(shortName),
                shortName,
                isDefault: shiftType.isDefault ?? false,
            },
            nextShiftTypes.length,
            rotationMode,
        );

        nextShiftTypes.push(nextShiftType);
    });

    const shiftTypesWithUniqueAutomaticMappings = nextShiftTypes.map((shiftType) => {
        if (shiftType.mappingStatus !== 'AUTO_MATCHED' || isUniqueAutomaticPreviousScheduleShiftMapping(shiftType, nextShiftTypes)) {
            return shiftType;
        }

        return {
            ...shiftType,
            startTime: '',
            endTime: '',
            isDefault: false,
            isOff: false,
            isCounted: true,
            classification: 'OTHER_WORK' as const,
            rotationSystem: 'NONE' as const,
            paidMinutes: null,
            mappingStatus: 'UNASSIGNED' as const,
        };
    });
    const importedMappedSlots = new Set(
        shiftTypesWithUniqueAutomaticMappings
            .filter((shiftType) => shiftType.source === 'schedule-input' && isOnboardingShiftMappingResolved(shiftType.mappingStatus))
            .map((shiftType) => `${resolveOnboardingRotationSystem(shiftType)}:${shiftType.classification}`),
    );
    const withoutReplacedAutoSeeds = shiftTypesWithUniqueAutomaticMappings.filter((shiftType) => {
        if (!shiftType.autoSeeded || shiftType.protectedByPreviousSchedule || shiftType.source === 'schedule-input') return true;

        return !importedMappedSlots.has(`${resolveOnboardingRotationSystem(shiftType)}:${shiftType.classification}`);
    });
    const usedColors = new Set<string>();

    let customColorIndex = 0;

    const distinctShiftTypes = withoutReplacedAutoSeeds.map((shiftType) => {
        const shortName = normalizeShiftShortName(shiftType.shortName);
        const color = normalizeColorKey(shiftType.color);

        if (isCoreShiftShortName(shortName)) {
            if (color) {
                usedColors.add(color);
            }

            return shiftType;
        }

        if (shouldReassignCustomShiftColor(color, usedColors)) {
            const nextColor = getAvailableOnboardingShiftColor(usedColors, customColorIndex);
            const nextColorKey = normalizeColorKey(nextColor);

            customColorIndex += 1;

            if (nextColorKey) {
                usedColors.add(nextColorKey);
            }

            return {
                ...shiftType,
                color: nextColor,
            };
        }

        customColorIndex += 1;

        if (color) {
            usedColors.add(color);
        }

        return shiftType;
    });

    return orderOnboardingShiftTypes(normalizeUploadedShiftTypes(distinctShiftTypes));
};
const buildDraftTeams = (names: string[]): TOnboardingTeamDraft[] =>
    names.map((name, index) => ({
        id: createLocalId(`team-${index + 1}`),
        name,
        divisions: [{divisionNum: 1, name: getDivisionFallbackLabel(1)}],
    }));
const remapPossibleShiftTypeIds = (
    nurses: TOnboardingNurseDraft[],
    previousShiftTypes: TOnboardingWardShiftType[],
    nextShiftTypes: TOnboardingWardShiftType[],
): TOnboardingNurseDraft[] => {
    const previousIdByCode = new Map(previousShiftTypes.filter(isOnboardingShiftTypeActive).map((type) => [type.shortName, type.id]));
    const active = nextShiftTypes.filter(isOnboardingShiftTypeActive);

    return nurses.map((nurse) => ({
        ...nurse,
        possibleShiftTypeIds: active
            .filter((type) => {
                const previousId = previousIdByCode.get(type.shortName);

                return isRestShiftOption(type) || !previousId || nurse.possibleShiftTypeIds.includes(previousId);
            })
            .map((type) => type.id),
    }));
};
const remapTeamIds = (
    nurses: TOnboardingNurseDraft[],
    prevTeams: TOnboardingTeamDraft[],
    nextTeams: TOnboardingTeamDraft[],
): TOnboardingNurseDraft[] => {
    const prevTeamNameById = new Map(prevTeams.map((team) => [team.id, team.name]));
    const nextTeamIdByName = new Map(nextTeams.map((team) => [team.name, team.id]));
    const fallbackTeamId = requireFirstTeamId(nextTeams);

    return nurses.map((nurse) => ({
        ...nurse,
        teamId: nextTeamIdByName.get(prevTeamNameById.get(nurse.teamId) ?? '') ?? fallbackTeamId,
        divisionNum: nurse.divisionNum ?? 1,
    }));
};
const buildParsedTeams = (parsed: TOnboardingParsedWardData, currentTeams: TOnboardingTeamDraft[]): TOnboardingTeamDraft[] | null => {
    // 근무표 한 장은 근무팀 하나다. 분석이 조를 주면 팀을 쪼개지 않고 그룹으로 담는다.
    const teamWithDivisions = parsed.teams?.find((team) => (team.divisions?.length ?? 0) > 0);

    if (teamWithDivisions?.divisions) {
        return [
            {
                id: createLocalId('team-1'),
                name: teamWithDivisions.name.trim() || currentTeams[0]?.name.trim() || getDefaultTeamName(1),
                divisions: teamWithDivisions.divisions.map((division) => ({
                    divisionNum: division.divisionNum,
                    name: division.name.trim() || getDivisionFallbackLabel(division.divisionNum),
                })),
            },
        ];
    }

    const teamNames = new Set<string>();

    parsed.teams?.forEach((team) => {
        if (team.name.trim()) teamNames.add(team.name.trim());
    });

    parsed.nurses?.forEach((nurse) => {
        if (nurse.teamName?.trim()) teamNames.add(nurse.teamName.trim());
    });

    if (teamNames.size === 0) {
        return null;
    }

    return buildDraftTeams(Array.from(teamNames));
};
const buildParsedNurses = (
    parsedNurses: TOnboardingParsedNurse[],
    teams: TOnboardingTeamDraft[],
    shiftTypes: TOnboardingWardShiftType[],
): TOnboardingNurseDraft[] => {
    const teamIdByName = new Map(teams.map((team) => [team.name, team.id]));
    const activeShiftTypes = shiftTypes.filter(isOnboardingShiftTypeActive);
    const fallbackTeamId = requireFirstTeamId(teams);

    return parsedNurses.map((nurse, index) => {
        const legacyRoleFlags = getNurseRoleFlagsFromMemo(nurse.memo);
        const importedCodes = new Set(nurse.possibleShiftShortNames);
        const hasKnownCodes = activeShiftTypes.some((type) => importedCodes.has(type.shortName));

        return {
            id: createLocalId(`nurse-${index + 1}`),
            teamId: teamIdByName.get(nurse.teamName?.trim() ?? '') ?? fallbackTeamId,
            divisionNum: nurse.divisionNum ?? 1,
            name: nurse.name ?? '',
            memo: getMemoWithoutNurseRoleMarker(nurse.memo),
            isPreceptor: nurse.isPreceptor ?? legacyRoleFlags.isPreceptor,
            isPreceptee: nurse.isPreceptee ?? legacyRoleFlags.isPreceptee,
            isWorker: nurse.isWorker ?? true,
            employmentDate: nurse.employmentDate ?? getTodayDate(),
            possibleShiftTypeIds: activeShiftTypes
                .filter((type) => !hasKnownCodes || importedCodes.has(type.shortName) || isRestShiftOption(type))
                .map((type) => type.id),
            initialShifts: nurse.initialShifts ?? [],
        };
    });
};
const collectWarnings = (response: TOnboardingWardParseApiResponse, copy: TOnboardingParseWarningCopy = DEFAULT_PARSE_WARNING_COPY) =>
    [
        ...(response.warnings ?? []),
        ...(response.quality_report?.warnings ?? []),
        ...(response.blocking_questions ?? []),
        ...(response.failedSheets ?? []).map(copy.failedSheet),
        ...(response.failedRows ?? []).map(copy.failedRow),
    ].filter((warning): warning is string => Boolean(warning?.trim()));

type TObservedShiftCodeStat = {
    count: number;
    firstSeen: number;
};

const addObservedShiftCodeStat = (
    stats: Map<string, TObservedShiftCodeStat>,
    rawCode: string | null | undefined,
    cursor: {value: number},
    count = 1,
) => {
    const shortName = normalizeShiftShortName(rawCode);

    if (!shortName || count <= 0) {
        return;
    }

    const prev = stats.get(shortName);

    if (prev) {
        stats.set(shortName, {...prev, count: prev.count + count});

        return;
    }

    stats.set(shortName, {count, firstSeen: cursor.value});
    cursor.value += 1;
};
const collectObservedShiftCodeStats = (response: TOnboardingWardParseApiResponse) => {
    const stats = new Map<string, TObservedShiftCodeStat>();
    const cursor = {value: 0};

    response.nurses?.forEach((nurse) => {
        Object.entries(nurse.assignments ?? {}).forEach(([, code]) => addObservedShiftCodeStat(stats, code, cursor));
    });

    response.nurse_candidates?.forEach((nurse) => {
        Object.entries(nurse.assignments ?? {}).forEach(([, code]) => addObservedShiftCodeStat(stats, code, cursor));
        Object.entries(nurse.monthly_counts ?? {}).forEach(([code, count]) => {
            addObservedShiftCodeStat(stats, code, cursor, count ?? 0);
        });
    });

    response.shift_type_candidates?.forEach((candidate) => {
        if (candidate.observed_count == null) {
            addObservedShiftCodeStat(stats, candidate.code, cursor);

            return;
        }

        addObservedShiftCodeStat(stats, candidate.code, cursor, candidate.observed_count);
    });

    return stats;
};
const remapShiftShortNameAlias = (shortName: string | undefined, aliases: Map<string, string>) =>
    shortName ? (aliases.get(shortName) ?? shortName) : shortName;
const collectResponseObservedShiftCodes = (response: TOnboardingWardParseApiResponse) => {
    const shiftCodes = new Set<string>(collectObservedShiftCodeStats(response).keys());

    response.nurses?.forEach((nurse) => {
        nurse.possibleShiftShortNames
            ?.map((shortName) => normalizeShiftShortName(shortName))
            .filter((shortName): shortName is string => Boolean(shortName))
            .forEach((shortName) => shiftCodes.add(shortName));
    });

    return Array.from(shiftCodes);
};
const appendObservedShiftTypes = (shiftTypes: TOnboardingParsedShiftType[], observedShiftCodes: string[]): TOnboardingParsedShiftType[] => {
    const existingShortNames = new Set(
        shiftTypes
            .map((shiftType) => normalizeShiftShortName(shiftType.shortName))
            .filter((shortName): shortName is string => Boolean(shortName)),
    );
    const nextShiftTypes = [...shiftTypes];

    observedShiftCodes.forEach((shortName) => {
        if (existingShortNames.has(shortName)) {
            return;
        }

        const classification = inferClassificationFromShortName(shortName, isOffShiftShortName(shortName));

        existingShortNames.add(shortName);
        nextShiftTypes.push(
            CORE_SHIFT_SHORT_NAMES.includes(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number])
                ? createCoreParsedShiftType(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number])
                : {
                      name: getShiftTypeNameFromShortName(shortName),
                      shortName,
                      isDefault: false,
                      isOff: classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE',
                      classification,
                      source: 'schedule-input',
                  },
        );
    });

    return nextShiftTypes;
};

type TNormalizedParsedShiftTypes = {
    shiftTypes?: TOnboardingParsedShiftType[];
    shortNameAliases: Map<string, string>;
};

const isPrimaryOffShiftType = (shiftType: TOnboardingParsedShiftType) =>
    isOffShiftShortName(normalizeShiftShortName(shiftType.shortName) ?? '');
const getObservedShiftStat = (shiftType: TOnboardingParsedShiftType, observedStats: Map<string, TObservedShiftCodeStat>) => {
    const shortName = normalizeShiftShortName(shiftType.shortName);

    return shortName ? observedStats.get(shortName) : undefined;
};
const isObservedShiftType = (shiftType: TOnboardingParsedShiftType, observedStats: Map<string, TObservedShiftCodeStat>) =>
    Boolean(getObservedShiftStat(shiftType, observedStats));
const isDefaultCoreFallbackShiftType = (shiftType: TOnboardingParsedShiftType) => {
    const shortName = normalizeShiftShortName(shiftType.shortName);

    return (
        shiftType.isDefault === true &&
        shortName !== '' &&
        CORE_SHIFT_SHORT_NAMES.includes(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number])
    );
};
const pickPrimaryOffShiftType = (
    offShiftTypes: TOnboardingParsedShiftType[],
    observedStats: Map<string, TObservedShiftCodeStat>,
): TOnboardingParsedShiftType => {
    const [firstOffShiftType] = offShiftTypes;

    return (
        offShiftTypes.slice().sort((left, right) => {
            const leftStat = getObservedShiftStat(left, observedStats);
            const rightStat = getObservedShiftStat(right, observedStats);
            const leftObserved = leftStat ? 1 : 0;
            const rightObserved = rightStat ? 1 : 0;

            if (leftObserved !== rightObserved) return rightObserved - leftObserved;

            if ((leftStat?.count ?? 0) !== (rightStat?.count ?? 0)) return (rightStat?.count ?? 0) - (leftStat?.count ?? 0);

            return (leftStat?.firstSeen ?? Number.MAX_SAFE_INTEGER) - (rightStat?.firstSeen ?? Number.MAX_SAFE_INTEGER);
        })[0] ?? firstOffShiftType!
    );
};
const normalizeParsedShiftTypeList = (
    shiftTypes: TOnboardingParsedShiftType[],
    observedStats: Map<string, TObservedShiftCodeStat>,
    supersededCodes: Set<string>,
): TNormalizedParsedShiftTypes => {
    const shortNameAliases = new Map<string, string>();
    const uniqueShiftTypes: TOnboardingParsedShiftType[] = [];
    const usedShortNames = new Set<string>();

    shiftTypes.forEach((shiftType) => {
        const shortName = normalizeShiftShortName(shiftType.shortName);

        if (!shortName || usedShortNames.has(shortName) || supersededCodes.has(shortName)) {
            return;
        }

        usedShortNames.add(shortName);
        uniqueShiftTypes.push({...shiftType, shortName});
    });

    const withoutUnobservedDefaults = uniqueShiftTypes.filter(
        (shiftType) => !isDefaultCoreFallbackShiftType(shiftType) || isObservedShiftType(shiftType, observedStats),
    );
    const primaryOffShiftTypes = withoutUnobservedDefaults.filter(isPrimaryOffShiftType);
    const primaryOffShiftType =
        primaryOffShiftTypes.length > 1 ? pickPrimaryOffShiftType(primaryOffShiftTypes, observedStats) : primaryOffShiftTypes[0];
    const primaryOffShortName = normalizeShiftShortName(primaryOffShiftType?.shortName);
    const originalOrderByShortName = new Map(
        withoutUnobservedDefaults
            .map((shiftType, index) => [normalizeShiftShortName(shiftType.shortName), index] as const)
            .filter((entry): entry is [string, number] => Boolean(entry[0])),
    );
    const normalizedShiftTypes = withoutUnobservedDefaults
        .filter((shiftType) => {
            const shortName = normalizeShiftShortName(shiftType.shortName);
            const isOff = isPrimaryOffShiftType(shiftType);

            if (!shortName || !isOff || !primaryOffShortName || shortName === primaryOffShortName) return true;

            shortNameAliases.set(shortName, primaryOffShortName);

            return false;
        })
        .map((shiftType) => {
            const shortName = normalizeShiftShortName(shiftType.shortName);

            return shortName === primaryOffShortName && isPrimaryOffShiftType(shiftType) ? {...shiftType, isDefault: true} : shiftType;
        })
        .sort((left, right) => {
            const leftShortName = normalizeShiftShortName(left.shortName);
            const rightShortName = normalizeShiftShortName(right.shortName);
            const leftStat = leftShortName ? observedStats.get(leftShortName) : undefined;
            const rightStat = rightShortName ? observedStats.get(rightShortName) : undefined;

            if (leftStat && rightStat) return leftStat.firstSeen - rightStat.firstSeen;

            if (leftStat || rightStat) return leftStat ? -1 : 1;

            return (originalOrderByShortName.get(leftShortName ?? '') ?? 0) - (originalOrderByShortName.get(rightShortName ?? '') ?? 0);
        });

    return {
        shiftTypes: normalizedShiftTypes.length > 0 ? normalizedShiftTypes : undefined,
        shortNameAliases,
    };
};
const normalizeParsedShiftTypes = (
    response: TOnboardingWardParseApiResponse,
    supersededCodes: Set<string>,
): TNormalizedParsedShiftTypes => {
    const rawShiftTypes = response.shiftTypes ?? response.wardShiftTypes;
    const observedStats = collectObservedShiftCodeStats(response);
    const observedShiftCodes = collectResponseObservedShiftCodes(response);

    if (rawShiftTypes) {
        return normalizeParsedShiftTypeList(
            appendObservedShiftTypes(
                rawShiftTypes
                    .map((shiftType) => {
                        const shortName = normalizeShiftShortName(shiftType.shortName);
                        const classification = shortName ? normalizeShiftClassification(shiftType.classification, shortName) : undefined;
                        const isOff =
                            shiftType.isOff ??
                            (classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE');

                        return {
                            name: trimToUndefined(shiftType.name) ?? getShiftTypeNameFromShortName(shortName ?? ''),
                            shortName,
                            startTime: trimToUndefined(shiftType.startTime),
                            endTime: trimToUndefined(shiftType.endTime),
                            color: trimToUndefined(shiftType.color),
                            isDefault: shiftType.isDefault ?? undefined,
                            isOff,
                            classification,
                            rotationSystem: shiftType.rotationSystem ?? undefined,
                            paidMinutes: shiftType.paidMinutes ?? undefined,
                            source: 'schedule-input' as const,
                        };
                    })
                    .filter((shiftType) => Boolean(shiftType.shortName)),
                observedShiftCodes,
            ),
            observedStats,
            supersededCodes,
        );
    }

    if (!response.shift_type_candidates) {
        return observedShiftCodes.length > 0
            ? normalizeParsedShiftTypeList(appendObservedShiftTypes([], observedShiftCodes), observedStats, supersededCodes)
            : {shortNameAliases: new Map()};
    }

    return normalizeParsedShiftTypeList(
        appendObservedShiftTypes(
            response.shift_type_candidates
                .map((shiftType) => {
                    const shortName = normalizeShiftShortName(shiftType.code);
                    const classification = shortName ? normalizeShiftClassification(shiftType.classification, shortName) : undefined;

                    return {
                        name: shortName ? getShiftTypeNameFromShortName(shortName) : shortName,
                        shortName,
                        isDefault: false,
                        isOff: classification === 'OFF' || classification === 'ANNUAL_LEAVE' || classification === 'OTHER_LEAVE',
                        classification,
                        source: 'schedule-input' as const,
                    };
                })
                .filter((shiftType) => Boolean(shiftType.shortName)),
            observedShiftCodes,
        ),
        observedStats,
        supersededCodes,
    );
};
const normalizeParsedTeams = (response: TOnboardingWardParseApiResponse): TOnboardingParsedTeam[] | undefined => {
    const rawTeams = response.teams ?? response.shiftTeams;

    if (!rawTeams) {
        return undefined;
    }

    return (
        rawTeams
            .map((team) => ({
                name: trimToUndefined(team.name) ?? '',
                divisions: (team.divisions ?? [])
                    .map((division) => ({
                        divisionNum: division.divisionNum ?? 0,
                        name: trimToUndefined(division.name) ?? '',
                    }))
                    .filter((division) => division.divisionNum > 0),
            }))
            // 근무표가 조로만 갈린 경우 팀 이름이 비어 온다. 조가 있으면 살려 둔다.
            .filter((team) => Boolean(team.name) || team.divisions.length > 0)
    );
};
const normalizeParsedNurses = (
    response: TOnboardingWardParseApiResponse,
    options?: TOnboardingWardParseOptions,
    shortNameAliases = new Map<string, string>(),
): TOnboardingParsedNurse[] | undefined => {
    if (response.nurses?.length || (response.nurses && !response.nurse_candidates?.length)) {
        return response.nurses
            .map((nurse) =>
                compactParsedNurse({
                    name: trimToUndefined(nurse.name),
                    memo: nurse.memo ?? undefined,
                    isPreceptor: nurse.isPreceptor ?? undefined,
                    isPreceptee: nurse.isPreceptee ?? undefined,
                    isWorker: nurse.isWorker ?? undefined,
                    employmentDate: trimToUndefined(nurse.employmentDate),
                    teamName: trimToUndefined(nurse.teamName),
                    divisionNum: nurse.divisionNum ?? undefined,
                    groupName: trimToUndefined(nurse.groupName),
                    possibleShiftShortNames:
                        nurse.possibleShiftShortNames
                            ?.map((shortName) => normalizeShiftShortName(shortName))
                            .map((shortName) => remapShiftShortNameAlias(shortName, shortNameAliases))
                            .filter((shortName): shortName is string => Boolean(shortName)) ?? undefined,
                    initialShifts: getImportedInitialShifts(nurse.assignments, nurse.unmapped_assignments, options, shortNameAliases),
                }),
            )
            .filter((nurse) => Boolean(nurse.name ?? nurse.teamName));
    }

    if (!response.nurse_candidates) {
        return undefined;
    }

    return response.nurse_candidates
        .map((nurse) =>
            compactParsedNurse({
                name: trimToUndefined(nurse.raw_name),
                possibleShiftShortNames: collectObservedWorkShiftCodes(nurse.assignments, nurse.monthly_counts)
                    .map((shortName) => remapShiftShortNameAlias(shortName, shortNameAliases))
                    .filter((shortName): shortName is string => Boolean(shortName)),
                initialShifts: getImportedInitialShifts(nurse.assignments, nurse.unmapped_assignments, options, shortNameAliases),
            }),
        )
        .filter((nurse) => Boolean(nurse.name));
};
const normalizeConstraintSeverity = (severityRecommendation: string | null | undefined): TShiftConstraintSeverity | undefined => {
    const normalized = severityRecommendation?.trim().toUpperCase();

    if (!normalized) return undefined;

    // 'HARD_AFTER_CONFIRM'은 "확인하면 HARD"라는 계약이지 HARD 가 아니다. 문자열에 HARD 가
    // 들어 있다는 이유로 눌러 보내면, 관측값이 사용자 확인 없이 병동 HARD 정책이 된다.
    // 확인 전에는 SOFT 로 두고, 승격은 서버가 confirmed 를 보고 판단한다.
    if (normalized === HARD_AFTER_CONFIRM) return 'SOFT';

    if (normalized.includes('HARD')) return 'HARD';

    if (normalized.includes('SOFT')) return 'SOFT';

    return undefined;
};
const normalizeParsedConstraintCandidates = (
    response: TOnboardingWardParseApiResponse,
): TOnboardingParsedConstraintCandidate[] | undefined => {
    const rawCandidates = response.constraintCandidates ?? response.constraint_candidates;

    if (!rawCandidates) {
        return undefined;
    }

    return rawCandidates
        .map((candidate) => {
            const templateCode = trimToUndefined(candidate.templateCode ?? candidate.template_code)?.toUpperCase();

            if (!templateCode || !SUPPORTED_CONSTRAINT_TEMPLATE_CODES.has(templateCode)) {
                return null;
            }

            return {
                key: trimToUndefined(candidate.key) ?? templateCode,
                templateCode,
                severity:
                    normalizeConstraintSeverity(candidate.severityRecommendation ?? candidate.severity_recommendation) ??
                    DEFAULT_CONSTRAINT_SEVERITY,
                category: trimToUndefined(candidate.category) ?? null,
                params: candidate.params ?? {},
                severityRecommendation: trimToUndefined(candidate.severityRecommendation ?? candidate.severity_recommendation) ?? null,
                confidence: typeof candidate.confidence === 'number' ? candidate.confidence : null,
                confidenceBand: trimToUndefined(candidate.confidenceBand ?? candidate.confidence_band) ?? null,
                evidenceSummary: trimToUndefined(candidate.evidenceSummary ?? candidate.evidence_summary) ?? templateCode,
                riskNote: trimToUndefined(candidate.riskNote ?? candidate.risk_note) ?? null,
                selected: candidate.prefill !== false,
            } satisfies TOnboardingParsedConstraintCandidate;
        })
        .filter((candidate): candidate is TOnboardingParsedConstraintCandidate => Boolean(candidate));
};
const toDraftConstraintCandidate = (candidate: TOnboardingParsedConstraintCandidate, index: number): TOnboardingConstraintDraft => ({
    ...candidate,
    id: createLocalId(`constraint-${index + 1}`),
});
const buildConstraintRulePayloads = (draft: TOnboardingWardDraft, teamId: string) => {
    return draft.constraintCandidates
        .filter(
            (constraint) =>
                constraint.selected &&
                constraint.templateCode &&
                !['TWO_SHIFT_MAX_LINES', 'CORE_MIN_REST_HOURS', 'MAX_MONTHLY_WORK_HOURS'].includes(constraint.templateCode),
        )
        .map((constraint) => ({
            templateCode: constraint.templateCode,
            severity: constraint.severity,
            // 원본 권고와 신뢰도를 그대로 넘긴다 — 서버의 확인 게이트와 저신뢰 차단이 이 값으로 판단한다.
            severityRecommendation: constraint.severityRecommendation,
            confidence: constraint.confidence,
            // 후보 확인 UI 가 복원되기 전까지 프리필은 '확인'이 아니다.
            confirmed: false,
            selected: constraint.selected,
            params: constraint.paramsByTeamId?.[teamId] ?? constraint.params,
        }));
};

export const getOnboardingUploadFailureMessage = (error: unknown, copy: TOnboardingUploadFailureCopy = DEFAULT_UPLOAD_FAILURE_COPY) => {
    const message = error instanceof Error ? error.message.trim() : '';

    if (!message) {
        return copy.defaultMessage;
    }

    if (message.includes('Network Error')) {
        return copy.networkMessage;
    }

    return message;
};

// Use raw, dated readings before normalizing known shift codes. Older analyzers can
// also send a canonical suggestion for the same cell; it must not create a phantom type.
const getPhotoImportCodes = (response: TOnboardingWardParseApiResponse, options?: TOnboardingWardParseOptions) => {
    const importedCodes = new Set<string>();
    const coveredKnownCodes = new Set<string>();
    const uncoveredKnownCodes = new Set<string>();
    const rows = response.nurses?.length ? response.nurses : (response.nurse_candidates ?? []);

    for (const row of rows) {
        const name = 'name' in row ? row.name : 'raw_name' in row ? row.raw_name : null;

        if (!name?.trim()) continue;

        const raw = getRawPhotoAssignments(row.unmapped_assignments, options);

        for (const code of raw.values()) importedCodes.add(code);

        for (const {date, shiftShortName} of normalizeInitialShifts(row.assignments, options)) {
            (raw.has(date) ? coveredKnownCodes : uncoveredKnownCodes).add(shiftShortName);
        }
    }

    return {
        importedCodes: Array.from(importedCodes),
        supersededCodes: new Set(
            [...coveredKnownCodes, ...[...importedCodes].map(normalizeOnboardingShiftCode)].filter(
                (code) => !uncoveredKnownCodes.has(code),
            ),
        ),
    };
};
// Some analyzers return staffing details in nurses and the original cell readings only
// in nurse_candidates. Join matching rows without assigning another team member's shifts.
const includeCandidatePhotoReadings = (response: TOnboardingWardParseApiResponse): TOnboardingWardParseApiResponse => {
    const candidates = response.nurse_candidates;

    if (!response.nurses?.length || !candidates?.some((candidate) => candidate.unmapped_assignments)) return response;

    const candidatesByName = new Map<string, typeof candidates>();

    for (const candidate of candidates) {
        const name = candidate.raw_name?.trim();

        if (name) candidatesByName.set(name, [...(candidatesByName.get(name) ?? []), candidate]);
    }

    const usedNames = new Set<string>();
    const duplicateNames = new Set<string>();

    for (const nurse of response.nurses) {
        const name = nurse.name?.trim();

        if (!name) continue;

        if (usedNames.has(name)) duplicateNames.add(name);

        usedNames.add(name);
    }

    return {
        ...response,
        nurses: response.nurses.map((nurse) => {
            const name = nurse.name?.trim();
            const matches = name ? candidatesByName.get(name) : undefined;

            if (!name || duplicateNames.has(name) || matches?.length !== 1 || !matches[0]?.unmapped_assignments) return nurse;

            return {...nurse, unmapped_assignments: {...matches[0].unmapped_assignments, ...nurse.unmapped_assignments}};
        }),
    };
};

export const buildOnboardingParseDraftInjection = (
    input: TOnboardingWardParseApiResponse,
    uploadedFileName: string,
    options?: TOnboardingWardParseOptions,
    copy: TOnboardingParseWarningCopy = DEFAULT_PARSE_WARNING_COPY,
): TOnboardingParseDraftInjection => {
    const response = includeCandidatePhotoReadings(input);
    const {importedCodes, supersededCodes} = getPhotoImportCodes(response, options);
    const normalizedShiftTypes = normalizeParsedShiftTypes(response, supersededCodes);

    return {
        parsedWardData: {
            ...(importedCodes.length ? {importedCodes} : {}),
            fileName: trimToUndefined(response.fileName) ?? uploadedFileName,
            wardName: trimToUndefined(response.wardName),
            hospitalName: trimToUndefined(response.hospitalName),
            shiftTypes: normalizedShiftTypes.shiftTypes,
            teams: normalizeParsedTeams(response),
            nurses: normalizeParsedNurses(response, options, normalizedShiftTypes.shortNameAliases),
            constraintCandidates: normalizeParsedConstraintCandidates(response),
        },
        warnings: collectWarnings(response, copy),
    };
};

// 병원이 쓰던 원본 근무표는 서식 좌표로 읽을 수 없어 서버 분석 결과로만 들어온다.
// 분석 결과에는 일자별 근무가 그대로 있으므로, '근무표 입력' 칸도 여기서 채운다.
// 안 채우면 사용자가 방금 올린 한 달치를 손으로 다시 입력해야 한다.
export const buildUploadedTeamSchedulesFromParsedWardData = (
    parsed: TOnboardingParsedWardData,
    monthKey?: string,
): TOnboardingUploadedTeamSchedule[] => {
    const teams = parsed.teams ?? [];
    const rowsByTeamName = new Map<string, TOnboardingUploadedTeamSchedule['rows']>();

    for (const nurse of parsed.nurses ?? []) {
        const name = nurse.name?.trim() ?? '';
        const shifts = Object.fromEntries(
            (nurse.initialShifts ?? [])
                .filter((shift) => !monthKey || shift.date.slice(0, 7) === monthKey)
                .map((shift) => [String(Number(shift.date.slice(8, 10))), shift.shiftShortName] as const)
                .filter(([day, shiftShortName]) => day !== 'NaN' && Boolean(shiftShortName)),
        );

        if (!name && Object.keys(shifts).length === 0) continue;

        const teamName = nurse.teamName?.trim() ? nurse.teamName.trim() : teams.length === 1 ? teams[0]!.name.trim() : '';
        const team = teams.find((candidate) => candidate.name.trim() === teamName);
        const divisionNum = nurse.divisionNum ?? DEFAULT_ONBOARDING_DIVISION_NUM;
        const division = team?.divisions?.find((item) => item.divisionNum === divisionNum);
        const rows = rowsByTeamName.get(teamName) ?? [];
        const roleFlags = getNurseRoleFlagsFromMemo(nurse.memo);

        rows.push({
            name,
            shifts,
            divisionNum,
            divisionName: division?.name.trim() ? division.name.trim() : (nurse.groupName?.trim() ?? ''),
            nurseSettings: {
                memo: getMemoWithoutNurseRoleMarker(nurse.memo),
                isWorker: nurse.isWorker,
                employmentDate: nurse.employmentDate,
                isPreceptor: nurse.isPreceptor ?? roleFlags.isPreceptor,
                isPreceptee: nurse.isPreceptee ?? roleFlags.isPreceptee,
                possibleShiftShortNames: nurse.possibleShiftShortNames,
            },
        });
        rowsByTeamName.set(teamName, rows);
    }

    const teamSchedules = Array.from(rowsByTeamName, ([teamName, rows]) => ({teamName, rows}));
    const hasAnyShift = teamSchedules.some((teamSchedule) => teamSchedule.rows.some((row) => Object.keys(row.shifts).length > 0));

    return hasAnyShift ? teamSchedules : [];
};

// 각 월의 행은 같은 팀·근무자 명단을 사용하고, 날짜별 근무만 달리한다.
export const buildUploadedMonthlySchedulesFromParsedWardData = (
    parsed: TOnboardingParsedWardData,
): TOnboardingUploadedMonthlySchedule[] => {
    const monthKeys = new Set<string>();

    for (const nurse of parsed.nurses ?? []) {
        for (const shift of nurse.initialShifts ?? []) {
            if (shift.shiftShortName && isValidIsoDate(shift.date)) monthKeys.add(shift.date.slice(0, 7));
        }
    }

    return Array.from(monthKeys)
        .sort()
        .map((monthKey) => ({
            year: Number(monthKey.slice(0, 4)),
            month: Number(monthKey.slice(5, 7)),
            teamSchedules: buildUploadedTeamSchedulesFromParsedWardData(parsed, monthKey),
        }));
};

export const applyParsedWardData = (
    draft: TOnboardingWardDraft,
    parsed: TOnboardingParsedWardData,
    labels?: TOnboardingDraftLabels,
): TOnboardingWardDraft => {
    const currentShiftTypes = parsed.fileName ? getShiftTypesForNewUpload(draft.shiftTypes) : draft.shiftTypes;
    const knownShiftTypes = parsed.shiftTypes
        ? ensureCoreShiftTypes(currentShiftTypes, parsed.shiftTypes, draft.rotationMode)
        : normalizeUploadedShiftTypes(currentShiftTypes);
    const rawCodes = new Set(parsed.importedCodes);
    const nextShiftTypes = [
        ...knownShiftTypes.filter((type) => !rawCodes.has(type.shortName)),
        ...Array.from(rawCodes, (code): TOnboardingWardShiftType => {
            const configured = currentShiftTypes.find(
                (type) =>
                    type.shortName === code &&
                    !type.autoSeeded &&
                    isOnboardingShiftTypeActive(type) &&
                    isOnboardingShiftMappingResolved(type.mappingStatus) &&
                    type.mappingStatus !== 'AUTO_MATCHED',
            );

            if (configured) return {...configured, importedCode: code, protectedByPreviousSchedule: true, mappingStatus: 'CONFIRMED'};

            return {
                ...createEmptyShiftType(),
                color: '',
                id: createLocalId('shift'),
                name: code,
                shortName: code,
                importedCode: code,
                startTime: '',
                endTime: '',
                source: 'schedule-input',
                protectedByPreviousSchedule: true,
                mappingStatus: 'UNASSIGNED',
            };
        }),
    ];
    const nextTeams = buildParsedTeams(parsed, draft.teams) ?? draft.teams;
    const nextNurses = parsed.nurses
        ? buildParsedNurses(parsed.nurses, nextTeams, nextShiftTypes)
        : remapTeamIds(remapPossibleShiftTypeIds(draft.nurses, draft.shiftTypes, nextShiftTypes), draft.teams, nextTeams);

    return ensureOnboardingAnnualLeave(
        normalizeOnboardingDivisions({
            ...draft,
            uploadedFileName: parsed.fileName ?? draft.uploadedFileName,
            wardName: parsed.wardName ?? draft.wardName,
            hospitalName: parsed.hospitalName ?? draft.hospitalName,
            shiftTypes: assignImportedShiftColors(nextShiftTypes),
            teams: nextTeams,
            nurses: nextNurses,
            constraintCandidates: parsed.constraintCandidates
                ? parsed.constraintCandidates.map(toDraftConstraintCandidate)
                : draft.constraintCandidates,
        }),
        labels,
    );
};

export const buildCreateWardPayload = (input: TOnboardingWardDraft, fallbackWardName = DEFAULT_WARD_FALLBACK_NAME): TCreateWardDTO => {
    const draft = normalizeOnboardingDivisions(input);
    const identity = buildOnboardingWardIdentityPayload(draft, fallbackWardName);
    const mappedShiftTypes = draft.shiftTypes.filter((shiftType) => isOnboardingShiftMappingResolved(shiftType.mappingStatus));
    const uniqueMappedShiftTypeByShortName = new Map<string, TOnboardingWardShiftType>();

    mappedShiftTypes.forEach((shiftType) => {
        const shortName = normalizeOnboardingShiftCode(shiftType.shortName);
        const existing = uniqueMappedShiftTypeByShortName.get(shortName);

        if (!existing || (!isOnboardingShiftTypeActive(existing) && isOnboardingShiftTypeActive(shiftType))) {
            uniqueMappedShiftTypeByShortName.set(shortName, shiftType);
        }
    });

    const uniqueMappedShiftTypes = Array.from(uniqueMappedShiftTypeByShortName.values());
    const shiftTypeById = new Map(
        mappedShiftTypes.map((shiftType) => [
            shiftType.id,
            uniqueMappedShiftTypeByShortName.get(normalizeOnboardingShiftCode(shiftType.shortName)) ?? shiftType,
        ]),
    );
    const getPossibleShiftShortNames = (nurse: TOnboardingNurseDraft) => {
        const selected = new Set(nurse.possibleShiftTypeIds.map((id) => shiftTypeById.get(id)));

        return uniqueMappedShiftTypes
            .filter((type) => isOnboardingShiftTypeActive(type) && (isRestShiftOption(type) || selected.has(type)))
            .map((type) => normalizeOnboardingShiftCode(type.shortName))
            .filter(Boolean);
    };
    const unresolvedPhotoCodes = new Set(
        draft.shiftTypes
            .filter((type) => type.importedCode && !isOnboardingShiftMappingResolved(type.mappingStatus))
            .flatMap((type) => [type.shortName, type.importedCode!, ...(type.shortNameAliases ?? [])]),
    );
    const resolveInitialShiftType = createScheduleShiftTypeResolver({...draft, shiftTypes: uniqueMappedShiftTypes});
    const getInitialShifts = (nurse: TOnboardingNurseDraft) => {
        const shifts = (nurse.initialShifts ?? []).flatMap((shift) => {
            if (unresolvedPhotoCodes.has(shift.shiftShortName)) return [];

            const resolved = resolveInitialShiftType(shift.shiftShortName);
            const shiftShortName = normalizeOnboardingShiftCode(resolved?.shortName ?? shift.shiftShortName);

            return uniqueMappedShiftTypeByShortName.has(shiftShortName) ? [{...shift, shiftShortName}] : [];
        });

        return shifts.length ? shifts : undefined;
    };

    return {
        ...(draft.onboardingSignals ? {onboardingSignals: draft.onboardingSignals} : {}),
        ...identity,
        rotationMode: draft.rotationMode,
        wardShiftTypes: uniqueMappedShiftTypes.map(
            ({
                id: _id,
                source: _source,
                importedCode,
                shortNameAliases: _shortNameAliases,
                protectedByPreviousSchedule: _protectedByPreviousSchedule,
                autoSeeded: _autoSeeded,
                mappingStatus,
                mappingRecommendation: _mappingRecommendation,
                ...shiftType
            }) => {
                const shortName = normalizeOnboardingShiftCode(shiftType.shortName);
                const classification =
                    importedCode && mappingStatus === 'CONFIRMED'
                        ? shiftType.classification
                        : getPayloadShiftClassification({...shiftType, shortName});
                const rotationSystem = resolveOnboardingRotationSystem({...shiftType, classification});

                return {
                    ...shiftType,
                    name: shiftType.name.trim() || shortName,
                    shortName,
                    classification,
                    rotationSystem,
                    paidMinutes: rotationSystem === 'NONE' ? null : shiftType.paidMinutes,
                };
            },
        ),
        shiftTeams: draft.teams.map((team) => {
            const constraintRules = buildConstraintRulePayloads(draft, team.id);
            const nurses = draft.nurses
                .filter((nurse) => nurse.teamId === team.id)
                .map((nurse) => ({
                    ...nurse,
                    requestName: normalizeNurseNameForRequest(nurse.name),
                }))
                .filter((nurse) => nurse.requestName);
            const divisions =
                team.divisions && team.divisions.length > 0
                    ? team.divisions
                    : [{divisionNum: DEFAULT_ONBOARDING_DIVISION_NUM, name: getDivisionFallbackLabel(DEFAULT_ONBOARDING_DIVISION_NUM)}];

            return {
                name: team.name,
                nurseNames: nurses.map((nurse) => nurse.requestName),
                divisions: divisions.map((division) => ({
                    divisionNum: division.divisionNum,
                    name: division.name,
                })),
                constraintRules: constraintRules.length > 0 ? constraintRules : undefined,
                nurses: nurses.map((nurse) => ({
                    name: nurse.requestName,
                    divisionNum: nurse.divisionNum ?? DEFAULT_ONBOARDING_DIVISION_NUM,
                    memo: getMemoWithoutNurseRoleMarker(nurse.memo),
                    isWorker: nurse.isWorker,
                    employmentDate: nurse.employmentDate,
                    isPreceptor: nurse.isPreceptor,
                    isPreceptee: nurse.isPreceptee,
                    possibleShiftShortNames: getPossibleShiftShortNames(nurse),
                    initialShifts: getInitialShifts(nurse),
                })),
            };
        }),
    };
};
