import {type TCreateWardDTO, type TShiftConstraintSeverity} from '@dutying/api/ward';
import {type DropResult} from '@hello-pangea/dnd';
import {isValidNurseName, NURSE_NAME_MAX_LENGTH, normalizeNurseNameForRequest} from '@/shared/lib/nurse-name';
import {
    getShiftShortNameEntryKey,
    getShiftShortNameValueKey,
    hasInvalidShiftShortNameEntryKey,
    hasInvalidShiftShortNameLengthInput,
} from '@/shared/lib/shift-short-name';

export {normalizeNurseNameForRequest};

export type TOnboardingStep = 1 | 2 | 3 | 4;

export type TOnboardingWardShiftType = TCreateWardDTO['wardShiftTypes'][number] & {
    id: string;
    source?: 'schedule-input';
    shortNameAliases?: string[];
    protectedByPreviousSchedule?: boolean;
};

export type TOnboardingTeamDraft = {
    id: string;
    name: string;
};

export type TOnboardingNurseDraft = {
    id: string;
    teamId: string;
    name: string;
    memo: string;
    isPreceptor: boolean;
    isPreceptee: boolean;
    isWorker: boolean;
    employmentDate: string;
    possibleShiftTypeIds: string[];
    level: number | null;
    initialShifts: {
        date: string;
        shiftShortName: string;
    }[];
};

export type TOnboardingScheduleRowDraft = {
    id: string;
    nurseId: string | null;
    name: string;
    shifts: Record<string, string>;
};

export type TOnboardingTeamScheduleDraft = {
    year: number;
    month: number;
    rows: TOnboardingScheduleRowDraft[];
};

export type TOnboardingTeamScheduleInputDraft = Record<string, TOnboardingTeamScheduleDraft | undefined>;

export type TOnboardingUploadedScheduleRow = {
    name: string;
    shifts: Record<string, string>;
};

export type TOnboardingUploadedTeamSchedule = {
    teamName: string;
    rows: TOnboardingUploadedScheduleRow[];
};

export type TOnboardingConstraintDraft = {
    id: string;
    key: string;
    templateCode: string;
    severity: TShiftConstraintSeverity;
    category: string | null;
    params: Record<string, unknown>;
    severityRecommendation: string | null;
    confidence: number | null;
    confidenceBand: string | null;
    evidenceSummary: string;
    riskNote: string | null;
    selected: boolean;
};

export type TSkillPalette = {
    id: string;
    colors: string[];
};

export type TSkillLevelConfig = {
    enabled: boolean;
    levelCount: number;
    paletteId: string;
    autoAssign: boolean;
    levelLabels?: Record<number, string>;
};

export type TOnboardingInitialScheduleTarget = {
    teamId: string;
    year: number;
    month: number;
    shiftTeamId?: number;
};

type TOnboardingCreatedWardShiftTeamLike = {
    shiftTeamId?: number;
    name?: string | null;
};

type TOnboardingCreatedWardLike = {
    shiftTeams?: TOnboardingCreatedWardShiftTeamLike[] | null;
};

export type TOnboardingWardDraft = {
    currentStep: TOnboardingStep;
    uploadedFileName: string | null;
    wardName: string;
    hospitalName: string;
    shiftTypes: TOnboardingWardShiftType[];
    teams: TOnboardingTeamDraft[];
    nurses: TOnboardingNurseDraft[];
    scheduleInputs: Record<string, TOnboardingTeamScheduleInputDraft | undefined>;
    constraintCandidates: TOnboardingConstraintDraft[];
    skillLevelConfig: TSkillLevelConfig;
};

export type TOnboardingValidationIssueCode =
    | 'missing-hospital-name'
    | 'invalid-ward-name'
    | 'invalid-hospital-name'
    | 'empty-shift-types'
    | 'missing-required-shift-types'
    | 'missing-shift-name'
    | 'missing-shift-short-name'
    | 'invalid-shift-short-name'
    | 'duplicate-shift-short-name'
    | 'missing-shift-time'
    | 'invalid-shift-time-format'
    | 'invalid-shift-time-order'
    | 'schedule-row-missing-nurse-name'
    | 'empty-team'
    | 'empty-team-nurses'
    | 'missing-nurse-name'
    | 'invalid-nurse-name';

export type TOnboardingValidationIssue = {
    code: TOnboardingValidationIssueCode;
    step: TOnboardingStep;
    targetId?: string;
};

export type TOnboardingStepValidation = {
    step: TOnboardingStep;
    isValid: boolean;
    issues: TOnboardingValidationIssue[];
};

export type TOnboardingActionState = {
    canGoPrev: boolean;
    canGoNext: boolean;
    canComplete: boolean;
};

const SKILL_PALETTES: TSkillPalette[] = [
    {id: 'warm', colors: ['#FFF3B8', '#FFE9B8', '#FFD8B8', '#FFB3A7']},
    {id: 'cool', colors: ['#BDE5FF', '#9FD7FF', '#7CC4FF', '#58ABF5']},
    {id: 'violet', colors: ['#FFE0EC', '#FFC4D7', '#FF9FBD', '#E85D8E']},
    {id: 'forest', colors: ['#D7F4C9', '#AEE6B8', '#6FCF97', '#2F9E6B']},
];

export const DEFAULT_SKILL_LEVEL_CONFIG: TSkillLevelConfig = {
    enabled: false,
    levelCount: 5,
    paletteId: 'warm',
    autoAssign: false,
};

const MIN_STEP = 1;
const MAX_STEP = 4;

export const MAX_ONBOARDING_TEAMS = 8;
export const MAX_ONBOARDING_SHIFT_TYPES = 10;
export const MAX_ONBOARDING_NURSES = 40;
export const MAX_ONBOARDING_NURSE_NAME_LENGTH = NURSE_NAME_MAX_LENGTH;
export const DEFAULT_SHIFT_TYPE_COLORS = [
    '#4DC2AD',
    '#FF8BA5',
    '#3580FF',
    '#465B7A',
    '#F7B8A8',
    '#F8D878',
    '#B8DC8F',
    '#8ADDE3',
    '#BFA7F3',
    '#F3A6CC',
] as const;
export const DEFAULT_OFF_SHIFT_TYPE_COLOR = DEFAULT_SHIFT_TYPE_COLORS[3];
export const CUSTOM_SHIFT_TYPE_COLORS = DEFAULT_SHIFT_TYPE_COLORS.slice(4);

const REQUIRED_COMPLETION_STEPS: TOnboardingStep[] = [1, 2, 3, 4];
const WARD_IDENTITY_REGEX = /^[a-zA-Z\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u3400-\u9FFF0-9\s]{1,20}$/u;
const SHIFT_TIME_FORMAT_REGEX = /^\d{2}:\d{2}$/;
const CORE_SHIFT_SHORT_NAMES = new Set(['D', 'E', 'N', 'O']);
const REQUIRED_SHIFT_CLASSIFICATIONS = ['DAY', 'EVENING', 'NIGHT', 'OFF'] as const;
const DEFAULT_TEAM_NAME_PREFIX = '\uAC04\uD638\uC0AC ';
const DEFAULT_TEAM_NAME_SUFFIX = '\uD300';
const DEFAULT_NEW_NURSE_PREFIX = '\uC2E0\uADDC \uAC04\uD638\uC0AC';
const DEFAULT_SAMPLE_NURSE_NAMES = {
    first: '\uD64D\uAE38\uB3D9',
    second: '\uAE40\uD558\uB298',
    skilled: '\uC774\uC11C\uC724',
    off: '\uBC15\uC5F0\uC6B0',
} as const;
const DEFAULT_OFF_SHIFT_ALIASES = {
    off: '\uC624\uD504',
    rest: '\uD734',
    leave: '\uD734\uBB34',
} as const;
const DEFAULT_SHIFT_NAMES = {
    day: '\uB370\uC774',
    evening: '\uC774\uBE0C\uB2DD',
    night: '\uB098\uC774\uD2B8',
    off: '\uC624\uD504',
} as const;

export type TOnboardingDraftLabels = {
    teamName: (teamNumber: number) => string;
    newNurseName: (nurseNumber: number) => string;
    sampleNurseNames: Record<keyof typeof DEFAULT_SAMPLE_NURSE_NAMES, string>;
    shiftNames: Record<keyof typeof DEFAULT_SHIFT_NAMES, string>;
};

export const DEFAULT_ONBOARDING_DRAFT_LABELS: TOnboardingDraftLabels = {
    teamName: (teamNumber) => `${DEFAULT_TEAM_NAME_PREFIX}${teamNumber}${DEFAULT_TEAM_NAME_SUFFIX}`,
    newNurseName: (nurseNumber) => `${DEFAULT_NEW_NURSE_PREFIX} ${nurseNumber}`,
    sampleNurseNames: DEFAULT_SAMPLE_NURSE_NAMES,
    shiftNames: DEFAULT_SHIFT_NAMES,
};

const getDefaultTeamName = (teamNumber: number, labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS) =>
    labels.teamName(teamNumber);
const normalizeColor = (color: string) => color.trim().toUpperCase();

export const normalizeOnboardingShiftCode = (value: string) => value.trim().toLocaleUpperCase();
export const isOnboardingShiftTypeActive = (shiftType: TOnboardingWardShiftType) => shiftType.isActive !== false;

export const getAvailableOnboardingShiftColor = (usedColors: Iterable<string>, fallbackIndex = 0): string => {
    const normalizedUsedColors = new Set(Array.from(usedColors).map(normalizeColor));
    const availableColor = CUSTOM_SHIFT_TYPE_COLORS.find((color) => !normalizedUsedColors.has(normalizeColor(color)));

    return availableColor ?? CUSTOM_SHIFT_TYPE_COLORS[fallbackIndex % CUSTOM_SHIFT_TYPE_COLORS.length] ?? DEFAULT_SHIFT_TYPE_COLORS[4];
};

export const getOnboardingShiftCodeColor = (shortName: string): string => {
    const normalized = normalizeOnboardingShiftCode(shortName);

    let hash = 0;

    Array.from(normalized).forEach((char) => {
        hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    });

    return CUSTOM_SHIFT_TYPE_COLORS[hash % CUSTOM_SHIFT_TYPE_COLORS.length] ?? DEFAULT_SHIFT_TYPE_COLORS[4];
};

let nextId = 7;

const createId = (prefix: string) => `${prefix}-${nextId++}`;
const createShiftType = (
    input: Omit<TOnboardingWardShiftType, 'id'> & {
        id?: string;
    },
): TOnboardingWardShiftType => ({
    id: input.id ?? createId('shift'),
    ...input,
});
const createScheduleInputShiftType = (shortName: string, color: string): TOnboardingWardShiftType => {
    const isOff = Boolean(getScheduleOffShiftShortName(shortName));

    return createShiftType({
        name: shortName,
        shortName,
        startTime: isOff ? '' : '09:00',
        endTime: isOff ? '' : '18:00',
        color: isOff ? DEFAULT_OFF_SHIFT_TYPE_COLOR : color,
        isDefault: isOff,
        isOff,
        isCounted: !isOff,
        classification: isOff ? 'OFF' : 'OTHER_WORK',
        source: 'schedule-input',
        protectedByPreviousSchedule: true,
    });
};
const createNurse = (
    input: Omit<TOnboardingNurseDraft, 'id' | 'initialShifts' | 'isPreceptor' | 'isPreceptee'> &
        Partial<Pick<TOnboardingNurseDraft, 'isPreceptor' | 'isPreceptee'>> & {
            id?: string;
            initialShifts?: TOnboardingNurseDraft['initialShifts'];
        },
): TOnboardingNurseDraft => ({
    id: input.id ?? createId('nurse'),
    ...input,
    isPreceptor: input.isPreceptor ?? false,
    isPreceptee: input.isPreceptee ?? false,
    initialShifts: input.initialShifts ?? [],
});
const createScheduleRow = (
    input: Partial<Omit<TOnboardingScheduleRowDraft, 'id'>> & {
        id?: string;
    } = {},
): TOnboardingScheduleRowDraft => ({
    id: input.id ?? createId('schedule-row'),
    nurseId: input.nurseId ?? null,
    name: input.name ?? '',
    shifts: input.shifts ?? {},
});
const createBaseShiftTypes = (labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS): TOnboardingWardShiftType[] => [
    createShiftType({
        id: 'shift-0',
        name: labels.shiftNames.day,
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#4DC2AD',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'DAY',
    }),
    createShiftType({
        id: 'shift-1',
        name: labels.shiftNames.evening,
        shortName: 'E',
        startTime: '15:00',
        endTime: '23:00',
        color: '#FF8BA5',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'EVENING',
    }),
    createShiftType({
        id: 'shift-2',
        name: labels.shiftNames.night,
        shortName: 'N',
        startTime: '23:00',
        endTime: '07:00',
        color: '#3580FF',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'NIGHT',
    }),
    createShiftType({
        id: 'shift-3',
        name: labels.shiftNames.off,
        shortName: 'O',
        startTime: '',
        endTime: '',
        color: '#465B7A',
        isDefault: true,
        isOff: true,
        isCounted: false,
        classification: 'OFF',
    }),
];
const createBaseTeams = (labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS): TOnboardingTeamDraft[] => [
    {id: 'team-4', name: getDefaultTeamName(1, labels)},
    {id: 'team-5', name: getDefaultTeamName(2, labels)},
    {id: 'team-6', name: getDefaultTeamName(3, labels)},
];
const getBaseNurseNames = (labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS) =>
    [labels.sampleNurseNames.first, labels.sampleNurseNames.second, labels.sampleNurseNames.skilled, labels.sampleNurseNames.off] as const;

export const skillPalettes = SKILL_PALETTES;

export const getSkillPalette = (paletteId: string) => skillPalettes.find((palette) => palette.id === paletteId) ?? skillPalettes[0];

const normalizeSkillPaletteId = (paletteId: string) =>
    skillPalettes.some((palette) => palette.id === paletteId) ? paletteId : skillPalettes[0].id;

export const getScheduleMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

const parseShiftTimeToMinutes = (value: string): number | null => {
    const normalizedValue = value.trim();

    if (!SHIFT_TIME_FORMAT_REGEX.test(normalizedValue)) return null;

    const [hour, minute] = normalizedValue.split(':').map(Number);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return hour * 60 + minute;
};

export const getDefaultShiftTypeColor = (shortName?: string | null, fallbackIndex = 0) => {
    switch (shortName?.trim().toUpperCase()) {
        case 'D':
            return '#4DC2AD';
        case 'E':
            return '#FF8BA5';
        case 'N':
            return '#3580FF';
        case 'O':
            return DEFAULT_OFF_SHIFT_TYPE_COLOR;
        default:
            return DEFAULT_SHIFT_TYPE_COLORS[fallbackIndex % DEFAULT_SHIFT_TYPE_COLORS.length] ?? DEFAULT_SHIFT_TYPE_COLORS[0];
    }
};

export const createEmptyShiftType = (colorIndex = 4): TOnboardingWardShiftType =>
    createShiftType({
        name: '',
        shortName: '',
        startTime: '09:00',
        endTime: '18:00',
        color: getDefaultShiftTypeColor('', colorIndex),
        isDefault: false,
        isOff: false,
        isCounted: true,
        classification: 'OTHER_WORK',
    });

export const createEmptyNurse = (
    teamId: string,
    shiftTypes: TOnboardingWardShiftType[],
    nurseNumber: number,
    labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS,
): TOnboardingNurseDraft =>
    createNurse({
        teamId,
        name: labels.newNurseName(nurseNumber),
        memo: '',
        isWorker: true,
        employmentDate: '2024-01-01',
        possibleShiftTypeIds: getActiveShiftTypeIds(shiftTypes),
        level: null,
        initialShifts: [],
    });

export const createInitialDraft = (labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS): TOnboardingWardDraft => {
    const shiftTypes = createBaseShiftTypes(labels);
    const teams = createBaseTeams(labels);
    const firstTeamId = teams[0]?.id ?? 'team-0';
    const possibleShiftTypeIds = shiftTypes.map((shiftType) => shiftType.id);
    const sampleNurseNames = labels.sampleNurseNames;
    const nurses = getBaseNurseNames(labels).map((name, index) => {
        const isOffNurse = name === sampleNurseNames.off;

        return createNurse({
            teamId: firstTeamId,
            name,
            memo: '',
            isWorker: !isOffNurse,
            employmentDate: '2024-01-01',
            possibleShiftTypeIds,
            level: null,
            initialShifts: [],
            id: `nurse-${index + 1}`,
        });
    });

    return {
        currentStep: 1,
        uploadedFileName: null,
        wardName: '',
        hospitalName: '',
        shiftTypes,
        teams,
        nurses,
        scheduleInputs: {},
        constraintCandidates: [],
        skillLevelConfig: DEFAULT_SKILL_LEVEL_CONFIG,
    };
};

export const applySkillLevels = (nurses: TOnboardingNurseDraft[], config: TSkillLevelConfig): TOnboardingNurseDraft[] => {
    const levelCount = Math.min(Math.max(config.levelCount, 2), 5);

    if (!config.autoAssign) {
        return nurses.map((nurse) => ({
            ...nurse,
            level: nurse.level == null ? null : Math.min(nurse.level, levelCount),
        }));
    }

    const sortedNurses = nurses
        .map((nurse) => ({nurse}))
        .sort((left, right) => left.nurse.employmentDate.localeCompare(right.nurse.employmentDate));
    const levelById = new Map<string, number>();

    sortedNurses.forEach(({nurse}, index) => {
        const ratio = sortedNurses.length <= 1 ? 0 : index / (sortedNurses.length - 1);
        const level = levelCount - Math.round(ratio * (levelCount - 1));

        levelById.set(nurse.id, Math.max(1, Math.min(levelCount, level)));
    });

    return nurses.map((nurse) => ({
        ...nurse,
        level: levelById.get(nurse.id) ?? levelCount,
    }));
};

export const goToStep = (draft: TOnboardingWardDraft, step: TOnboardingStep): TOnboardingWardDraft => ({
    ...draft,
    currentStep: step,
});

export const goNextStep = (draft: TOnboardingWardDraft): TOnboardingWardDraft => ({
    ...draft,
    currentStep: Math.min(MAX_STEP, draft.currentStep + 1) as TOnboardingStep,
});

export const goPreviousStep = (draft: TOnboardingWardDraft): TOnboardingWardDraft => ({
    ...draft,
    currentStep: Math.max(MIN_STEP, draft.currentStep - 1) as TOnboardingStep,
});

export const prepareManualEntryDraft = (
    draft: TOnboardingWardDraft,
    labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS,
): TOnboardingWardDraft => ({
    ...draft,
    teams: draft.teams[0] ? [draft.teams[0]] : [{id: createId('team'), name: getDefaultTeamName(1, labels)}],
    nurses: [],
    scheduleInputs: {},
    constraintCandidates: [],
});

const isScheduleRowUsed = (row: TOnboardingScheduleRowDraft) =>
    Boolean(row.name.trim()) || Object.values(row.shifts).some((value) => value.trim());

export const hasScheduleInputDraft = (draft: TOnboardingWardDraft): boolean =>
    Object.values(draft.scheduleInputs ?? {}).some((teamScheduleInputs) =>
        Object.values(teamScheduleInputs ?? {}).some((schedule) => schedule?.rows.some(isScheduleRowUsed)),
    );

export const getOnboardingInitialScheduleTarget = (
    draft: TOnboardingWardDraft,
    options: {preferredTeamId?: string; createdWard?: TOnboardingCreatedWardLike | null} = {},
): TOnboardingInitialScheduleTarget | null => {
    return getOnboardingInitialScheduleTargets(draft, options)[0] ?? null;
};

export const getOnboardingInitialScheduleTargets = (
    draft: TOnboardingWardDraft,
    options: {preferredTeamId?: string; createdWard?: TOnboardingCreatedWardLike | null} = {},
): TOnboardingInitialScheduleTarget[] => {
    const preferredTeam = options.preferredTeamId ? draft.teams.find((team) => team.id === options.preferredTeamId) : undefined;
    const orderedTeams = preferredTeam ? [preferredTeam, ...draft.teams.filter((team) => team.id !== preferredTeam.id)] : draft.teams;
    const createdShiftTeams = options.createdWard?.shiftTeams ?? [];

    return orderedTeams.flatMap((team) => {
        const latestSchedule = Object.values(draft.scheduleInputs?.[team.id] ?? {})
            .filter((schedule): schedule is TOnboardingTeamScheduleDraft => Boolean(schedule?.rows.some(isScheduleRowUsed)))
            .sort((left, right) => right.year * 12 + right.month - (left.year * 12 + left.month))[0];

        if (!latestSchedule) {
            return [];
        }

        const teamIndex = draft.teams.findIndex((candidate) => candidate.id === team.id);
        const shiftTeamByName = createdShiftTeams.find((candidate) => candidate.name === team.name);
        const shiftTeamByIndex = teamIndex >= 0 ? createdShiftTeams[teamIndex] : undefined;
        const shiftTeamId = shiftTeamByName?.shiftTeamId ?? shiftTeamByIndex?.shiftTeamId;

        return [
            {
                teamId: team.id,
                year: latestSchedule.year,
                month: latestSchedule.month,
                ...(typeof shiftTeamId === 'number' ? {shiftTeamId} : {}),
            },
        ];
    });
};

const normalizeScheduleRow = (row: TOnboardingScheduleRowDraft): TOnboardingScheduleRowDraft => ({
    ...createScheduleRow(row),
    name: row.name,
    shifts: Object.fromEntries(Object.entries(row.shifts).map(([day, value]) => [day, value.trim()])),
});
const SCHEDULE_OFF_SHIFT_ALIASES = new Set([
    'O',
    '/',
    '-',
    'OFF',
    DEFAULT_OFF_SHIFT_ALIASES.off,
    DEFAULT_OFF_SHIFT_ALIASES.rest,
    DEFAULT_OFF_SHIFT_ALIASES.leave,
    '\u4F11',
    '\u4F11\u307F',
    '\u4F11\u65E5',
    '\u516C\u4F11',
]);
const DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME = 'O';
const getScheduleOffShiftShortName = (value: string): string | null => {
    const normalized = normalizeOnboardingShiftCode(value);

    if (!normalized || !SCHEDULE_OFF_SHIFT_ALIASES.has(normalized)) return null;

    return normalized === 'OFF' ? DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME : normalized;
};
const normalizeScheduleShiftShortName = (value: string): string | null => {
    const normalized = normalizeOnboardingShiftCode(value);

    if (!normalized) return null;

    // The previous schedule's code is an identifier. Preserve it even when it
    // looks like a built-in alias (e.g. N may mean a day shift at this ward).
    return normalized === 'OFF' ? DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME : normalized;
};
const normalizeShiftCodeToRemap = (value: string | undefined) => {
    const normalized = value ? normalizeOnboardingShiftCode(value) : '';

    return normalized || null;
};
const getShiftTypeRemapCodes = (shiftType: TOnboardingWardShiftType, shiftTypes: TOnboardingWardShiftType[]) => {
    const codes = new Set<string>();
    const oldShortName = normalizeShiftCodeToRemap(shiftType.shortName);
    const oldShortNameKey = oldShortName ? getShiftShortNameValueKey(oldShortName) : '';
    const oldShortNameIsDuplicated =
        oldShortNameKey &&
        shiftTypes.some((candidate) => candidate.id !== shiftType.id && getShiftShortNameValueKey(candidate.shortName) === oldShortNameKey);

    if (oldShortName && !oldShortNameIsDuplicated) {
        codes.add(oldShortName);
    }

    shiftType.shortNameAliases?.forEach((alias) => {
        const normalizedAlias = normalizeShiftCodeToRemap(alias);

        if (normalizedAlias) {
            codes.add(normalizedAlias);
        }
    });

    return codes;
};
const hasDuplicateShiftShortName = (shiftTypes: TOnboardingWardShiftType[], shiftTypeId: string, shortName: string | null) => {
    if (!shortName) {
        return false;
    }

    const shortNameKey = getShiftShortNameEntryKey(shortName);

    if (!shortNameKey) {
        return false;
    }

    return shiftTypes.some((shiftType) => shiftType.id !== shiftTypeId && getShiftShortNameEntryKey(shiftType.shortName) === shortNameKey);
};
const remapScheduleInputsShiftCode = (
    scheduleInputs: TOnboardingWardDraft['scheduleInputs'],
    fromCodes: Set<string>,
    toCode: string,
): TOnboardingWardDraft['scheduleInputs'] =>
    Object.fromEntries(
        Object.entries(scheduleInputs ?? {}).map(([teamId, teamScheduleInputs]) => [
            teamId,
            Object.fromEntries(
                Object.entries(teamScheduleInputs ?? {}).map(([monthKey, schedule]) => [
                    monthKey,
                    schedule
                        ? {
                              ...schedule,
                              rows: schedule.rows.map((row) => ({
                                  ...row,
                                  shifts: Object.fromEntries(
                                      Object.entries(row.shifts).map(([day, value]) => [
                                          day,
                                          fromCodes.has(normalizeOnboardingShiftCode(value)) ? toCode : value,
                                      ]),
                                  ),
                              })),
                          }
                        : undefined,
                ]),
            ),
        ]),
    );
const remapNurseInitialShiftCode = (nurses: TOnboardingNurseDraft[], fromCodes: Set<string>, toCode: string): TOnboardingNurseDraft[] =>
    nurses.map((nurse) => ({
        ...nurse,
        initialShifts: nurse.initialShifts.map((shift) =>
            fromCodes.has(normalizeOnboardingShiftCode(shift.shiftShortName)) ? {...shift, shiftShortName: toCode} : shift,
        ),
    }));
const getActiveShiftTypeIds = (shiftTypes: TOnboardingWardShiftType[]) =>
    shiftTypes.filter(isOnboardingShiftTypeActive).map((shiftType) => shiftType.id);
const getScheduleInputOffShiftShortName = (scheduleInputs: TOnboardingWardDraft['scheduleInputs']): string => {
    for (const teamScheduleInputs of Object.values(scheduleInputs ?? {})) {
        for (const schedule of Object.values(teamScheduleInputs ?? {})) {
            if (!schedule) continue;

            for (const row of schedule.rows) {
                const orderedShifts = Object.entries(row.shifts).sort(([leftDay], [rightDay]) => Number(leftDay) - Number(rightDay));

                for (const [, value] of orderedShifts) {
                    const offShortName = getScheduleOffShiftShortName(value);

                    if (offShortName) return offShortName;
                }
            }
        }
    }

    return DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME;
};
const isShiftShortNameReferencedByScheduleInputs = (scheduleInputs: TOnboardingWardDraft['scheduleInputs'], shortName: string | null) => {
    if (!shortName) {
        return false;
    }

    return Object.values(scheduleInputs ?? {}).some((teamScheduleInputs) =>
        Object.values(teamScheduleInputs ?? {}).some((schedule) =>
            schedule?.rows.some((row) => Object.values(row.shifts).some((value) => normalizeScheduleShiftShortName(value) === shortName)),
        ),
    );
};
const isShiftShortNameReferencedByInitialShifts = (nurses: TOnboardingNurseDraft[], shortName: string | null) => {
    if (!shortName) {
        return false;
    }

    return nurses.some((nurse) => nurse.initialShifts.some((shift) => normalizeScheduleShiftShortName(shift.shiftShortName) === shortName));
};
const isShiftTypeReferencedByInitialSchedules = (draft: TOnboardingWardDraft, shiftType: TOnboardingWardShiftType) => {
    const shortName = normalizeShiftCodeToRemap(shiftType.shortName);

    return (
        isShiftShortNameReferencedByScheduleInputs(draft.scheduleInputs, shortName) ||
        isShiftShortNameReferencedByInitialShifts(draft.nurses, shortName)
    );
};
const replacePossibleShiftTypeId = (shiftTypeIds: string[], fromShiftTypeId: string, toShiftTypeId: string) => {
    if (!shiftTypeIds.includes(fromShiftTypeId)) {
        return shiftTypeIds.filter((shiftTypeId) => shiftTypeId !== toShiftTypeId);
    }

    const nextShiftTypeIds = shiftTypeIds
        .filter((shiftTypeId) => shiftTypeId !== toShiftTypeId)
        .map((shiftTypeId) => (shiftTypeId === fromShiftTypeId ? toShiftTypeId : shiftTypeId));

    return nextShiftTypeIds.includes(toShiftTypeId) ? nextShiftTypeIds : [...nextShiftTypeIds, toShiftTypeId];
};
const collectScheduleShiftShortNames = (schedule: TOnboardingTeamScheduleDraft): string[] => {
    const shiftShortNames = new Set<string>();

    schedule.rows.forEach((row) => {
        Object.values(row.shifts).forEach((value) => {
            const shiftShortName = normalizeScheduleShiftShortName(value);

            if (!shiftShortName || CORE_SHIFT_SHORT_NAMES.has(shiftShortName)) {
                return;
            }

            shiftShortNames.add(shiftShortName);
        });
    });

    return Array.from(shiftShortNames).sort((left, right) => left.localeCompare(right, 'ko-KR'));
};
const collectScheduleInputShiftShortNames = (scheduleInputs: TOnboardingWardDraft['scheduleInputs']): Set<string> => {
    const shiftShortNames = new Set<string>();

    Object.values(scheduleInputs ?? {}).forEach((teamScheduleInputs) => {
        Object.values(teamScheduleInputs ?? {}).forEach((schedule) => {
            if (!schedule) {
                return;
            }

            collectScheduleShiftShortNames(schedule).forEach((shortName) => {
                shiftShortNames.add(shortName);
            });
        });
    });

    return shiftShortNames;
};
const collectScheduleInputObservedShiftShortNames = (scheduleInputs: TOnboardingWardDraft['scheduleInputs']): Set<string> => {
    const shiftShortNames = new Set<string>();

    Object.values(scheduleInputs ?? {}).forEach((teamScheduleInputs) => {
        Object.values(teamScheduleInputs ?? {}).forEach((schedule) => {
            if (!schedule) {
                return;
            }

            schedule.rows.forEach((row) => {
                Object.values(row.shifts).forEach((value) => {
                    const shortName = normalizeScheduleShiftShortName(value);

                    if (shortName) {
                        shiftShortNames.add(shortName);
                    }
                });
            });
        });
    });

    return shiftShortNames;
};
const isScheduleInputGeneratedShiftType = (shiftType: TOnboardingWardShiftType) => {
    if (shiftType.source === 'schedule-input') {
        return true;
    }

    const shortName = normalizeScheduleShiftShortName(shiftType.shortName);

    if (!shortName || CORE_SHIFT_SHORT_NAMES.has(shortName)) {
        return false;
    }

    return (
        !shiftType.isDefault &&
        !shiftType.isOff &&
        shiftType.classification === 'OTHER_WORK' &&
        shiftType.startTime.trim() === '' &&
        shiftType.endTime.trim() === '' &&
        normalizeOnboardingShiftCode(shiftType.name) === shortName
    );
};
const setPreviousScheduleProtection = (shiftType: TOnboardingWardShiftType, shouldProtect: boolean): TOnboardingWardShiftType => {
    if (shouldProtect) {
        return shiftType.protectedByPreviousSchedule ? shiftType : {...shiftType, protectedByPreviousSchedule: true};
    }

    if (!shiftType.protectedByPreviousSchedule) {
        return shiftType;
    }

    const nextShiftType = {...shiftType};

    delete nextShiftType.protectedByPreviousSchedule;

    return nextShiftType;
};
const syncScheduleInputShiftTypes = (
    shiftTypes: TOnboardingWardShiftType[],
    scheduleInputs: TOnboardingWardDraft['scheduleInputs'],
): TOnboardingWardShiftType[] => {
    const scheduleShortNames = collectScheduleInputShiftShortNames(scheduleInputs);
    const observedScheduleShortNames = collectScheduleInputObservedShiftShortNames(scheduleInputs);
    const offShortName = getScheduleInputOffShiftShortName(scheduleInputs);
    const existingShortNames = new Set<string>();
    const usedColors = new Set<string>();
    const nextShiftTypes = shiftTypes.flatMap((shiftType) => {
        const shortName = normalizeOnboardingShiftCode(shiftType.shortName);
        const isUnselectedDefaultOff =
            offShortName !== DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME &&
            shortName === DEFAULT_SCHEDULE_OFF_SHIFT_SHORT_NAME &&
            shiftType.isDefault &&
            shiftType.isOff;
        const shouldProtect = Boolean(shortName && observedScheduleShortNames.has(shortName));
        const nextShiftType = setPreviousScheduleProtection(shiftType, shouldProtect);
        const shouldRemove =
            isUnselectedDefaultOff || (isScheduleInputGeneratedShiftType(nextShiftType) && !scheduleShortNames.has(shortName));

        if (shouldRemove) {
            return [];
        }

        if (shortName) {
            existingShortNames.add(shortName);
        }

        usedColors.add(nextShiftType.color);

        return [nextShiftType];
    });

    Array.from(scheduleShortNames)
        .sort((left, right) => left.localeCompare(right, 'ko-KR'))
        .forEach((shortName) => {
            if (existingShortNames.has(shortName)) {
                return;
            }

            const color = getAvailableOnboardingShiftColor(usedColors, nextShiftTypes.length - CORE_SHIFT_SHORT_NAMES.size);

            existingShortNames.add(shortName);
            usedColors.add(color);
            nextShiftTypes.push(createScheduleInputShiftType(shortName, color));
        });

    return nextShiftTypes;
};
const pruneUnavailableShiftTypeIds = (nurses: TOnboardingNurseDraft[], shiftTypes: TOnboardingWardShiftType[]): TOnboardingNurseDraft[] => {
    const availableShiftTypeIds = new Set(getActiveShiftTypeIds(shiftTypes));

    return nurses.map((nurse) => ({
        ...nurse,
        possibleShiftTypeIds: nurse.possibleShiftTypeIds.filter((shiftTypeId) => availableShiftTypeIds.has(shiftTypeId)),
    }));
};
const toScheduleInitialShiftDate = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const buildScheduleInitialShifts = (
    schedule: TOnboardingTeamScheduleDraft,
    row: TOnboardingScheduleRowDraft,
): TOnboardingNurseDraft['initialShifts'] => {
    const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();

    return Object.entries(row.shifts)
        .flatMap(([dayKey, value]) => {
            const day = Number(dayKey);
            const shiftShortName = normalizeScheduleShiftShortName(value);

            if (!Number.isInteger(day) || day < 1 || day > daysInMonth || !shiftShortName) {
                return [];
            }

            return [
                {
                    date: toScheduleInitialShiftDate(schedule.year, schedule.month, day),
                    shiftShortName,
                },
            ];
        })
        .sort((left, right) => left.date.localeCompare(right.date));
};

export const applyScheduleInputDraft = (
    draft: TOnboardingWardDraft,
    teamId: string,
    schedule: TOnboardingTeamScheduleDraft,
): TOnboardingWardDraft => {
    if (!teamId) {
        return draft;
    }

    const monthKey = getScheduleMonthKey(schedule.year, schedule.month);
    const updatedTeamScheduleInputs: TOnboardingTeamScheduleInputDraft = {
        ...(draft.scheduleInputs?.[teamId] ?? {}),
        [monthKey]: {
            year: schedule.year,
            month: schedule.month,
            rows: schedule.rows.map(normalizeScheduleRow),
        },
    };
    const nextScheduleInputs = {
        ...(draft.scheduleInputs ?? {}),
        [teamId]: updatedTeamScheduleInputs,
    };
    const existingTeamNurses = draft.nurses.filter((nurse) => nurse.teamId === teamId);
    const otherNurses = draft.nurses.filter((nurse) => nurse.teamId !== teamId);
    const existingNurseById = new Map(existingTeamNurses.map((nurse) => [nurse.id, nurse]));
    const nextNurseById = new Map<string, TOnboardingNurseDraft>();
    const nextNurseIdByName = new Map<string, string>();
    const nextShiftTypes = syncScheduleInputShiftTypes(draft.shiftTypes, nextScheduleInputs);
    const possibleShiftTypeIds = nextShiftTypes
        .filter((shiftType) => isOnboardingShiftTypeActive(shiftType) && !shiftType.isOff)
        .map((shiftType) => shiftType.id);
    const defaultEmploymentDate = new Date().toISOString().slice(0, 10);
    const nurseIdByRowKey = new Map<string, string>();
    const getRowKey = (scheduleMonthKey: string, rowId: string) => `${scheduleMonthKey}:${rowId}`;

    Object.entries(updatedTeamScheduleInputs).forEach(([scheduleMonthKey, teamSchedule]) => {
        teamSchedule?.rows.forEach((row) => {
            const trimmedName = row.name.trim();

            if (!trimmedName) {
                return;
            }

            const existingNextNurseId = nextNurseIdByName.get(trimmedName);
            const existingNextNurse = existingNextNurseId ? nextNurseById.get(existingNextNurseId) : undefined;
            const exactNurse = row.nurseId ? (nextNurseById.get(row.nurseId) ?? existingNurseById.get(row.nurseId)) : undefined;
            const sameNameNurse =
                existingNextNurse ?? existingTeamNurses.find((nurse) => !nextNurseById.has(nurse.id) && nurse.name.trim() === trimmedName);
            const nextNurse =
                exactNurse ??
                sameNameNurse ??
                createNurse({
                    teamId,
                    name: trimmedName,
                    memo: '',
                    isWorker: true,
                    employmentDate: defaultEmploymentDate,
                    possibleShiftTypeIds,
                    level: null,
                });
            const normalizedNurse = {
                ...nextNurse,
                teamId,
                name: trimmedName,
            };

            nextNurseById.set(normalizedNurse.id, normalizedNurse);
            nextNurseIdByName.set(trimmedName, normalizedNurse.id);
            nurseIdByRowKey.set(getRowKey(scheduleMonthKey, row.id), normalizedNurse.id);
        });
    });

    const updatedTeamScheduleInputsWithNurseIds = Object.fromEntries(
        Object.entries(updatedTeamScheduleInputs).map(([scheduleMonthKey, teamSchedule]) => [
            scheduleMonthKey,
            teamSchedule
                ? {
                      ...teamSchedule,
                      rows: teamSchedule.rows.map((row) => ({
                          ...row,
                          nurseId: row.name.trim() ? (nurseIdByRowKey.get(getRowKey(scheduleMonthKey, row.id)) ?? row.nurseId) : null,
                      })),
                  }
                : undefined,
        ]),
    );
    const initialShiftsByNurseId = new Map<string, TOnboardingNurseDraft['initialShifts']>();

    Object.values(updatedTeamScheduleInputsWithNurseIds).forEach((teamSchedule) => {
        teamSchedule?.rows.forEach((row) => {
            if (!row.nurseId) {
                return;
            }

            initialShiftsByNurseId.set(row.nurseId, [
                ...(initialShiftsByNurseId.get(row.nurseId) ?? []),
                ...buildScheduleInitialShifts(teamSchedule, row),
            ]);
        });
    });

    const nextTeamNurses = Array.from(nextNurseById.values()).map((nurse) => ({
        ...nurse,
        initialShifts: (initialShiftsByNurseId.get(nurse.id) ?? []).sort((left, right) => left.date.localeCompare(right.date)),
    }));

    return {
        ...draft,
        shiftTypes: nextShiftTypes,
        nurses: pruneUnavailableShiftTypeIds([...otherNurses, ...nextTeamNurses], nextShiftTypes),
        scheduleInputs: {
            ...(draft.scheduleInputs ?? {}),
            [teamId]: updatedTeamScheduleInputsWithNurseIds,
        },
    };
};

const createUniqueUploadedTeamName = (
    rawTeamName: string,
    teamIndex: number,
    usedTeamNames: Set<string>,
    labels: TOnboardingDraftLabels,
) => {
    const baseName = rawTeamName.trim() || getDefaultTeamName(teamIndex + 1, labels);

    let nextName = baseName;
    let suffix = 2;

    while (usedTeamNames.has(nextName)) {
        nextName = `${baseName} ${suffix}`;
        suffix += 1;
    }

    usedTeamNames.add(nextName);

    return nextName;
};

export const applyUploadedScheduleTemplateDraft = (
    draft: TOnboardingWardDraft,
    {
        fileName,
        year,
        month,
        teamSchedules,
    }: {
        fileName: string;
        year: number;
        month: number;
        teamSchedules: TOnboardingUploadedTeamSchedule[];
    },
    labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS,
): {draft: TOnboardingWardDraft; activeTeamId: string | null} => {
    const normalizedTeamSchedules = teamSchedules
        .map((teamSchedule) => ({
            ...teamSchedule,
            rows: teamSchedule.rows.filter((row) => row.name.trim() || Object.values(row.shifts).some((shift) => shift.trim())),
        }))
        .filter((teamSchedule) => teamSchedule.rows.length > 0);

    if (normalizedTeamSchedules.length === 0) {
        return {draft, activeTeamId: null};
    }

    const monthKey = getScheduleMonthKey(year, month);
    const usedTeamNames = new Set<string>();
    const possibleShiftTypeIds = getActiveShiftTypeIds(draft.shiftTypes);
    const defaultEmploymentDate = new Date().toISOString().slice(0, 10);
    const teams: TOnboardingTeamDraft[] = [];
    const nurses: TOnboardingNurseDraft[] = [];
    const scheduleInputs: TOnboardingWardDraft['scheduleInputs'] = {};

    normalizedTeamSchedules.forEach((teamSchedule, teamIndex) => {
        const team = {
            id: createId('team'),
            name: createUniqueUploadedTeamName(teamSchedule.teamName, teamIndex, usedTeamNames, labels),
        };
        const nurseIdByName = new Map<string, string>();

        teams.push(team);

        scheduleInputs[team.id] = {
            [monthKey]: {
                year,
                month,
                rows: teamSchedule.rows.map((row) => {
                    const trimmedName = row.name.trim();
                    const shifts = Object.fromEntries(
                        Object.entries(row.shifts)
                            .map(([day, shift]) => [day, shift.trim()])
                            .filter(([, shift]) => shift),
                    );

                    let nurseId: string | null = null;

                    if (trimmedName) {
                        nurseId = nurseIdByName.get(trimmedName) ?? null;

                        if (!nurseId) {
                            const nurse = createNurse({
                                teamId: team.id,
                                name: trimmedName,
                                memo: '',
                                isWorker: true,
                                employmentDate: defaultEmploymentDate,
                                possibleShiftTypeIds,
                                level: null,
                            });

                            nurseId = nurse.id;
                            nurseIdByName.set(trimmedName, nurse.id);
                            nurses.push(nurse);
                        }
                    }

                    return createScheduleRow({
                        nurseId,
                        name: trimmedName,
                        shifts,
                    });
                }),
            },
        };
    });

    const nextShiftTypes = syncScheduleInputShiftTypes(draft.shiftTypes, scheduleInputs);
    const nextPossibleShiftTypeIds = getActiveShiftTypeIds(nextShiftTypes);

    return {
        draft: {
            ...draft,
            uploadedFileName: fileName,
            shiftTypes: nextShiftTypes,
            teams,
            nurses: nurses.map((nurse) => ({
                ...nurse,
                possibleShiftTypeIds: nextPossibleShiftTypeIds,
            })),
            scheduleInputs,
        },
        activeTeamId: teams[0]?.id ?? null,
    };
};

export const updateShiftTypeDraft = (
    draft: TOnboardingWardDraft,
    shiftTypeId: string,
    updater: Partial<TOnboardingWardShiftType>,
): TOnboardingWardDraft => {
    const targetShiftType = draft.shiftTypes.find((shiftType) => shiftType.id === shiftTypeId);
    const effectiveUpdater = {...updater};

    if (targetShiftType?.protectedByPreviousSchedule && updater.isActive === false) {
        delete effectiveUpdater.isActive;

        if (Object.keys(effectiveUpdater).length === 0) {
            return draft;
        }
    }

    const isShortNameUpdate = Object.prototype.hasOwnProperty.call(effectiveUpdater, 'shortName');
    const nextShortName = isShortNameUpdate ? normalizeShiftCodeToRemap(effectiveUpdater.shortName) : null;
    const canRemapShortName =
        isShortNameUpdate && nextShortName && targetShiftType
            ? !hasDuplicateShiftShortName(draft.shiftTypes, shiftTypeId, nextShortName)
            : false;
    const remapCodes = canRemapShortName && targetShiftType ? getShiftTypeRemapCodes(targetShiftType, draft.shiftTypes) : new Set<string>();
    const shouldRemap = Boolean(nextShortName && remapCodes.size > 0 && !remapCodes.has(nextShortName));
    const archivedShiftTypeWithSameShortName =
        isShortNameUpdate && nextShortName
            ? draft.shiftTypes.find(
                  (shiftType) =>
                      shiftType.id !== shiftTypeId &&
                      !isOnboardingShiftTypeActive(shiftType) &&
                      normalizeShiftCodeToRemap(shiftType.shortName) === nextShortName,
              )
            : undefined;

    if (targetShiftType && archivedShiftTypeWithSameShortName) {
        const restoredShiftTypeWithCodeName = {
            ...archivedShiftTypeWithSameShortName,
            startTime: archivedShiftTypeWithSameShortName.startTime.trim()
                ? archivedShiftTypeWithSameShortName.startTime
                : targetShiftType.startTime,
            endTime: archivedShiftTypeWithSameShortName.endTime.trim()
                ? archivedShiftTypeWithSameShortName.endTime
                : targetShiftType.endTime,
            ...effectiveUpdater,
            id: archivedShiftTypeWithSameShortName.id,
            isActive: true,
        };
        const {source: _source, shortNameAliases: _shortNameAliases, ...restoredShiftType} = restoredShiftTypeWithCodeName;

        return {
            ...draft,
            shiftTypes: draft.shiftTypes.flatMap((shiftType) => {
                if (shiftType.id === shiftTypeId) {
                    return [];
                }

                if (shiftType.id === archivedShiftTypeWithSameShortName.id) {
                    return [restoredShiftType];
                }

                return [shiftType];
            }),
            nurses: draft.nurses.map((nurse) => ({
                ...nurse,
                possibleShiftTypeIds: replacePossibleShiftTypeId(
                    nurse.possibleShiftTypeIds,
                    targetShiftType.id,
                    archivedShiftTypeWithSameShortName.id,
                ),
            })),
        };
    }

    const shiftTypes = draft.shiftTypes.map((shiftType) => {
        if (shiftType.id !== shiftTypeId) {
            return shiftType;
        }

        const nextAliases = new Set(
            isShortNameUpdate && !shouldRemap ? Array.from(getShiftTypeRemapCodes(shiftType, draft.shiftTypes)) : [],
        );
        const {source: _source, shortNameAliases: _shortNameAliases, ...nextShiftTypeCandidate} = {...shiftType, ...effectiveUpdater};
        const nextShiftType = nextShiftTypeCandidate;

        if (nextAliases.size === 0) {
            return nextShiftType;
        }

        return {
            ...nextShiftType,
            shortNameAliases: Array.from(nextAliases),
        };
    });

    if (!shouldRemap || !nextShortName) {
        return {
            ...draft,
            shiftTypes,
        };
    }

    return {
        ...draft,
        shiftTypes,
        nurses: remapNurseInitialShiftCode(draft.nurses, remapCodes, nextShortName),
        scheduleInputs: remapScheduleInputsShiftCode(draft.scheduleInputs, remapCodes, nextShortName),
    };
};

export const addShiftTypeDraft = (draft: TOnboardingWardDraft): TOnboardingWardDraft => {
    if (draft.shiftTypes.filter(isOnboardingShiftTypeActive).length >= MAX_ONBOARDING_SHIFT_TYPES) {
        return draft;
    }

    const shiftType = createEmptyShiftType(draft.shiftTypes.filter(isOnboardingShiftTypeActive).length);

    return {
        ...draft,
        shiftTypes: [...draft.shiftTypes, shiftType],
        nurses: draft.nurses.map((nurse) => ({
            ...nurse,
            possibleShiftTypeIds: nurse.possibleShiftTypeIds.includes(shiftType.id)
                ? nurse.possibleShiftTypeIds
                : [...nurse.possibleShiftTypeIds, shiftType.id],
        })),
    };
};

export const deleteShiftTypeDraft = (draft: TOnboardingWardDraft, shiftTypeId: string): TOnboardingWardDraft => {
    const targetShiftType = draft.shiftTypes.find((shiftType) => shiftType.id === shiftTypeId);

    if (targetShiftType?.protectedByPreviousSchedule) {
        return draft;
    }

    const shouldArchive = targetShiftType ? isShiftTypeReferencedByInitialSchedules(draft, targetShiftType) : false;
    const nextNurses = draft.nurses.map((nurse) => ({
        ...nurse,
        possibleShiftTypeIds: nurse.possibleShiftTypeIds.filter((value) => value !== shiftTypeId),
    }));

    if (!targetShiftType || !shouldArchive) {
        return {
            ...draft,
            shiftTypes: draft.shiftTypes.filter((shiftType) => shiftType.id !== shiftTypeId),
            nurses: nextNurses,
        };
    }

    return {
        ...draft,
        shiftTypes: draft.shiftTypes.map((shiftType) =>
            shiftType.id === shiftTypeId
                ? {
                      ...shiftType,
                      isActive: false,
                  }
                : shiftType,
        ),
        nurses: nextNurses,
    };
};

export const updateNurseDraft = (
    draft: TOnboardingWardDraft,
    nurseId: string,
    updater: Partial<TOnboardingNurseDraft>,
): TOnboardingWardDraft => ({
    ...draft,
    nurses: draft.nurses.map((nurse) => (nurse.id === nurseId ? {...nurse, ...updater} : nurse)),
});

export const updateTeamNameDraft = (draft: TOnboardingWardDraft, teamId: string, teamName: string): TOnboardingWardDraft => {
    const trimmedName = teamName.trim();

    if (!trimmedName) {
        return draft;
    }

    const duplicated = draft.teams.some((team) => team.id !== teamId && team.name.trim() === trimmedName);

    if (duplicated) {
        return draft;
    }

    return {
        ...draft,
        teams: draft.teams.map((team) => (team.id === teamId ? {...team, name: trimmedName} : team)),
    };
};

export const updateConstraintCandidateDraft = (
    draft: TOnboardingWardDraft,
    constraintId: string,
    updater: Partial<TOnboardingConstraintDraft>,
): TOnboardingWardDraft => ({
    ...draft,
    constraintCandidates: draft.constraintCandidates.map((constraint) =>
        constraint.id === constraintId ? {...constraint, ...updater} : constraint,
    ),
});

export const addTeamDraft = (draft: TOnboardingWardDraft, labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS) => {
    if (draft.teams.length >= MAX_ONBOARDING_TEAMS) {
        return {
            draft,
            addedTeamId: null,
        };
    }

    const existingTeamNames = new Set(draft.teams.map((team) => team.name.trim()));

    let nextTeamNumber = draft.teams.length + 1;
    let nextTeamName = getDefaultTeamName(nextTeamNumber, labels);

    while (existingTeamNames.has(nextTeamName)) {
        nextTeamNumber += 1;
        nextTeamName = getDefaultTeamName(nextTeamNumber, labels);
    }

    const team = {
        id: `team-new-${draft.teams.length + 1}`,
        name: nextTeamName,
    };

    return {
        draft: {
            ...draft,
            teams: [...draft.teams, team],
        },
        addedTeamId: team.id,
    };
};

export const addNurseDraft = (
    draft: TOnboardingWardDraft,
    teamId: string,
    labels: TOnboardingDraftLabels = DEFAULT_ONBOARDING_DRAFT_LABELS,
): TOnboardingWardDraft => {
    if (!teamId) {
        return draft;
    }

    const nurseNumber = draft.nurses.length + 1;

    return {
        ...draft,
        nurses: [...draft.nurses, createEmptyNurse(teamId, draft.shiftTypes, nurseNumber, labels)],
    };
};

export const deleteTeamDraft = (draft: TOnboardingWardDraft, teamId: string): TOnboardingWardDraft => ({
    ...draft,
    teams: draft.teams.filter((team) => team.id !== teamId),
    nurses: draft.nurses.filter((nurse) => nurse.teamId !== teamId),
    scheduleInputs: Object.fromEntries(
        Object.entries(draft.scheduleInputs ?? {}).filter(([candidateTeamId]) => candidateTeamId !== teamId),
    ),
});

export const deleteNurseDraft = (draft: TOnboardingWardDraft, nurseId: string): TOnboardingWardDraft => ({
    ...draft,
    nurses: draft.nurses.filter((nurse) => nurse.id !== nurseId),
});

export const reorderNursesWithinTeam = (
    draft: TOnboardingWardDraft,
    teamId: string,
    result: Pick<DropResult, 'destination' | 'source'>,
): TOnboardingWardDraft => {
    const {destination, source} = result;

    if (!destination || !teamId || destination.index === source.index) {
        return draft;
    }

    const teamNurses = draft.nurses.filter((nurse) => nurse.teamId === teamId);
    const otherNurses = draft.nurses.filter((nurse) => nurse.teamId !== teamId);
    const nextNurses = [...teamNurses];
    const [moved] = nextNurses.splice(source.index, 1);

    if (!moved) {
        return draft;
    }

    nextNurses.splice(destination.index, 0, moved);

    return {
        ...draft,
        nurses: [...otherNurses, ...nextNurses],
    };
};

export const reorderShiftTypes = (
    draft: TOnboardingWardDraft,
    result: Pick<DropResult, 'destination' | 'source'>,
): TOnboardingWardDraft => {
    const {destination, source} = result;

    if (!destination || source.index === destination.index || source.droppableId !== destination.droppableId) {
        return draft;
    }

    const activeShiftTypes = draft.shiftTypes.filter(isOnboardingShiftTypeActive);
    const nextActiveShiftTypes = [...activeShiftTypes];
    const [moved] = nextActiveShiftTypes.splice(source.index, 1);

    if (!moved) {
        return draft;
    }

    nextActiveShiftTypes.splice(destination.index, 0, moved);

    let activeShiftTypeIndex = 0;

    const nextShiftTypes = draft.shiftTypes.map((shiftType) => {
        if (!isOnboardingShiftTypeActive(shiftType)) {
            return shiftType;
        }

        return nextActiveShiftTypes[activeShiftTypeIndex++]!;
    });

    return {
        ...draft,
        shiftTypes: nextShiftTypes,
    };
};

export const saveSkillLevelConfig = (draft: TOnboardingWardDraft, config: TSkillLevelConfig): TOnboardingWardDraft => {
    const normalizedConfig = {
        ...config,
        paletteId: normalizeSkillPaletteId(config.paletteId),
    };

    return {
        ...draft,
        skillLevelConfig: normalizedConfig,
        nurses: applySkillLevels(draft.nurses, normalizedConfig),
    };
};

const validateShiftTypes = (draft: TOnboardingWardDraft): TOnboardingValidationIssue[] => {
    const issues: TOnboardingValidationIssue[] = [];
    const shiftShortNameCountByEntryKey = new Map<string, number>();
    const step: TOnboardingStep = 3;
    const activeShiftTypes = draft.shiftTypes.filter(isOnboardingShiftTypeActive);

    if (activeShiftTypes.length === 0) {
        issues.push({code: 'empty-shift-types', step});
    }

    const activeClassifications = new Set(activeShiftTypes.map((shiftType) => shiftType.classification));

    if (REQUIRED_SHIFT_CLASSIFICATIONS.some((classification) => !activeClassifications.has(classification))) {
        issues.push({code: 'missing-required-shift-types', step});
    }

    activeShiftTypes.forEach((shiftType) => {
        const normalizedShortName = getShiftShortNameEntryKey(shiftType.shortName);

        if (normalizedShortName) {
            shiftShortNameCountByEntryKey.set(normalizedShortName, (shiftShortNameCountByEntryKey.get(normalizedShortName) ?? 0) + 1);
        }
    });

    activeShiftTypes.forEach((shiftType) => {
        const normalizedName = shiftType.name.trim();
        const normalizedShortName = shiftType.shortName.trim().toLocaleUpperCase();
        const normalizedShortNameDuplicateKey = getShiftShortNameEntryKey(shiftType.shortName);

        if (!normalizedName) {
            issues.push({code: 'missing-shift-name', step, targetId: shiftType.id});
        }

        if (!normalizedShortName) {
            issues.push({code: 'missing-shift-short-name', step, targetId: shiftType.id});
        } else if (hasInvalidShiftShortNameLengthInput(shiftType.shortName) || hasInvalidShiftShortNameEntryKey(normalizedShortName)) {
            issues.push({code: 'invalid-shift-short-name', step, targetId: shiftType.id});
        } else if ((shiftShortNameCountByEntryKey.get(normalizedShortNameDuplicateKey) ?? 0) > 1) {
            issues.push({code: 'duplicate-shift-short-name', step, targetId: shiftType.id});
        }

        if (shiftType.isOff) {
            return;
        }

        const normalizedStartTime = shiftType.startTime.trim();
        const normalizedEndTime = shiftType.endTime.trim();

        if (!normalizedStartTime || !normalizedEndTime) {
            issues.push({code: 'missing-shift-time', step, targetId: shiftType.id});

            return;
        }

        const startMinutes = parseShiftTimeToMinutes(normalizedStartTime);
        const endMinutes = parseShiftTimeToMinutes(normalizedEndTime);

        if (startMinutes == null || endMinutes == null) {
            issues.push({code: 'invalid-shift-time-format', step, targetId: shiftType.id});

            return;
        }

        const isSameTime = endMinutes === startMinutes;

        if (isSameTime) {
            issues.push({code: 'invalid-shift-time-order', step, targetId: shiftType.id});
        }
    });

    return issues;
};
const validateWardIdentity = (draft: TOnboardingWardDraft, step: 1): TOnboardingValidationIssue[] => {
    const issues: TOnboardingValidationIssue[] = [];
    const wardName = draft.wardName.trim();
    const hospitalName = draft.hospitalName.trim();

    if (!hospitalName) {
        issues.push({code: 'missing-hospital-name', step});
    }

    if (wardName && !WARD_IDENTITY_REGEX.test(wardName)) {
        issues.push({code: 'invalid-ward-name', step});
    }

    if (hospitalName && !WARD_IDENTITY_REGEX.test(hospitalName)) {
        issues.push({code: 'invalid-hospital-name', step});
    }

    return issues;
};
const validateScheduleInputs = (draft: TOnboardingWardDraft, step: 2): TOnboardingValidationIssue[] => {
    const issues: TOnboardingValidationIssue[] = [];
    const nurseNameById = new Map(draft.nurses.map((nurse) => [nurse.id, nurse.name.trim()]));

    Object.values(draft.scheduleInputs ?? {}).forEach((teamScheduleInputs) => {
        Object.values(teamScheduleInputs ?? {}).forEach((schedule) => {
            schedule?.rows.forEach((row) => {
                const hasShift = Object.values(row.shifts).some((value) => value.trim());
                const rowDisplayName = row.name.trim() || (row.nurseId ? (nurseNameById.get(row.nurseId) ?? '') : '');

                if (hasShift && !rowDisplayName) {
                    issues.push({code: 'schedule-row-missing-nurse-name', step, targetId: row.id});
                }
            });
        });
    });

    return issues;
};
const validateTeamsAndNurses = (draft: TOnboardingWardDraft, step: 4): TOnboardingValidationIssue[] => {
    const issues: TOnboardingValidationIssue[] = [];

    if (draft.teams.length === 0) {
        issues.push({code: 'empty-team', step});
    }

    draft.teams.forEach((team) => {
        const nurses = draft.nurses.filter((nurse) => nurse.teamId === team.id);

        if (nurses.length === 0) {
            issues.push({code: 'empty-team-nurses', step, targetId: team.id});
        }

        nurses.forEach((nurse) => {
            if (!nurse.name.trim()) {
                issues.push({code: 'missing-nurse-name', step, targetId: nurse.id});
            } else if (!isValidNurseName(nurse.name)) {
                issues.push({code: 'invalid-nurse-name', step, targetId: nurse.id});
            }
        });
    });

    return issues;
};

export const getStepValidation = (draft: TOnboardingWardDraft, step = draft.currentStep): TOnboardingStepValidation => {
    let issues: TOnboardingValidationIssue[] = [];

    switch (step) {
        case 1:
            issues = validateWardIdentity(draft, step);
            break;
        case 2:
            issues = validateScheduleInputs(draft, step);
            break;
        case 3:
            issues = validateShiftTypes(draft);
            break;
        case 4:
            issues = validateTeamsAndNurses(draft, step);
            break;
    }

    return {
        step,
        isValid: issues.length === 0,
        issues,
    };
};

export const canGoPrev = (draft: Pick<TOnboardingWardDraft, 'currentStep'>): boolean => draft.currentStep > MIN_STEP;

export const canGoNext = (draft: TOnboardingWardDraft): boolean => draft.currentStep < MAX_STEP && getStepValidation(draft).isValid;

export const canComplete = (draft: TOnboardingWardDraft): boolean =>
    draft.currentStep === MAX_STEP && REQUIRED_COMPLETION_STEPS.every((step) => getStepValidation(draft, step).isValid);

export const getCompletionValidationIssues = (draft: TOnboardingWardDraft): TOnboardingValidationIssue[] =>
    REQUIRED_COMPLETION_STEPS.flatMap((step) => getStepValidation(draft, step).issues);

export const getActionState = (draft: TOnboardingWardDraft): TOnboardingActionState => ({
    canGoPrev: canGoPrev(draft),
    canGoNext: canGoNext(draft),
    canComplete: canComplete(draft),
});
