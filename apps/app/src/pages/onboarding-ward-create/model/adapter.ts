import {type TCreateWardDTO, type TShiftConstraintSeverity} from '@dutying/api/ward';
import {v4 as uuidv4} from 'uuid';
import {type TOnboardingWardParseApiResponse, type TOnboardingWardParseOptions} from '@/shared/api/file/type';
import {
    createEmptyShiftType,
    getDefaultShiftTypeColor,
    getOnboardingShiftCodeColor,
    normalizeOnboardingShiftCode,
    normalizeNurseNameForRequest,
    type TOnboardingConstraintDraft,
    type TOnboardingNurseDraft,
    type TOnboardingTeamDraft,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
    type TSkillLevelConfig,
} from './draft';

export type TOnboardingParsedShiftType = Partial<Omit<TCreateWardDTO['wardShiftTypes'][number], 'isCounted'>> & {
    name?: string;
    shortName?: string;
};

export type TOnboardingParsedTeam = {
    name: string;
};

export type TOnboardingParsedInitialShift = {
    date: string;
    shiftShortName: string;
};

export type TOnboardingParsedNurse = Partial<Pick<TOnboardingNurseDraft, 'name' | 'memo' | 'isWorker' | 'employmentDate' | 'level'>> & {
    teamName?: string;
    possibleShiftShortNames?: string[];
    initialShifts?: TOnboardingParsedInitialShift[];
};

export type TOnboardingParsedConstraintCandidate = Omit<TOnboardingConstraintDraft, 'id'>;

export type TOnboardingParsedWardData = {
    fileName?: string;
    wardName?: string;
    hospitalName?: string;
    shiftTypes?: TOnboardingParsedShiftType[];
    teams?: TOnboardingParsedTeam[];
    nurses?: TOnboardingParsedNurse[];
    constraintCandidates?: TOnboardingParsedConstraintCandidate[];
    skillLevelConfig?: Partial<TSkillLevelConfig>;
};

export type TOnboardingParseDraftInjection = {
    parsedWardData: TOnboardingParsedWardData;
    warnings: string[];
};

const SHIFT_TIME_RANGES: Record<string, {startTime: string; endTime: string}> = {
    D: {startTime: '07:00', endTime: '15:00'},
    E: {startTime: '15:00', endTime: '23:00'},
    N: {startTime: '23:00', endTime: '07:00'},
};
const SUPPORTED_ONBOARDING_UPLOAD_EXTENSIONS = ['xlsx', 'xls'] as const;
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
const CORE_SHIFT_SHORT_NAMES = ['D', 'E', 'N', 'O'] as const;
const SHIFT_CODE_LABELS: Record<string, string> = {
    D: '데이',
    E: '이브닝',
    N: '나이트',
    O: '오프',
};
const VALID_SHIFT_CLASSIFICATIONS = new Set<TOnboardingWardShiftType['classification']>([
    'DAY',
    'EVENING',
    'NIGHT',
    'OTHER_WORK',
    'OFF',
    'OTHER_LEAVE',
]);
const createLocalId = (prefix: string) => `${prefix}-${uuidv4()}`;
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
const inferClassificationFromShortName = (shortName: string, isOff: boolean): TOnboardingWardShiftType['classification'] => {
    if (isOff) return 'OFF';

    switch (shortName.toUpperCase()) {
        case 'D':
            return 'DAY';
        case 'E':
            return 'EVENING';
        case 'N':
            return 'NIGHT';
        case 'O':
            // Parse payloads can contain an "O" short name before isOff is normalized.
            return 'OFF';
        default:
            return 'OTHER_WORK';
    }
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

    return inferClassificationFromShortName(shortName, shortName.toUpperCase() === 'O');
};
const getShiftTypeNameFromShortName = (shortName: string) => SHIFT_CODE_LABELS[shortName.toUpperCase()] ?? shortName;
const normalizeShiftShortName = (value?: string | null) => {
    const trimmed = trimToUndefined(value);

    return trimmed ? normalizeOnboardingShiftCode(trimmed) : undefined;
};
const collectObservedWorkShiftCodes = (
    assignments?: Record<string, string | null> | null,
    monthlyCounts?: Record<string, number | null> | null,
) => {
    const shiftCodes = new Set<string>();

    Object.values(assignments ?? {}).forEach((code) => {
        const normalizedCode = normalizeShiftShortName(code);

        if (normalizedCode && normalizedCode !== 'O') {
            shiftCodes.add(normalizedCode);
        }
    });

    Object.entries(monthlyCounts ?? {}).forEach(([code, count]) => {
        const normalizedCode = normalizeShiftShortName(code);

        if (normalizedCode && normalizedCode !== 'O' && (count ?? 0) > 0) {
            shiftCodes.add(normalizedCode);
        }
    });

    return Array.from(shiftCodes);
};
const normalizeUploadedShiftTypes = (shiftTypes: TOnboardingWardShiftType[]): TOnboardingWardShiftType[] =>
    shiftTypes.map((shiftType) => {
        const timeRange = SHIFT_TIME_RANGES[shiftType.shortName];

        return timeRange ? {...shiftType, ...timeRange} : shiftType;
    });
const createCoreParsedShiftType = (shortName: (typeof CORE_SHIFT_SHORT_NAMES)[number]): TOnboardingParsedShiftType => ({
    name: getShiftTypeNameFromShortName(shortName),
    shortName,
    isDefault: true,
    isOff: shortName === 'O',
    classification: inferClassificationFromShortName(shortName, shortName === 'O'),
});
const toDraftShiftType = (parsed: TOnboardingParsedShiftType, colorIndex = 0): TOnboardingWardShiftType => {
    const base = createEmptyShiftType(colorIndex);
    const shortName = parsed.shortName ?? base.shortName;
    const isOff = parsed.isOff ?? false;

    return {
        ...base,
        id: createLocalId('shift'),
        name: parsed.name ?? base.name,
        shortName,
        startTime: parsed.startTime ?? base.startTime,
        endTime: parsed.endTime ?? base.endTime,
        color: parsed.color ?? getDefaultShiftTypeColor(shortName, colorIndex),
        isDefault: parsed.isDefault ?? false,
        isOff,
        isCounted: parsed.isOff ? false : base.isCounted,
        classification: parsed.classification ?? inferClassificationFromShortName(shortName, isOff),
    };
};
const ensureCoreShiftTypes = (
    draftShiftTypes: TOnboardingWardShiftType[],
    parsedShiftTypes: TOnboardingParsedShiftType[],
): TOnboardingWardShiftType[] => {
    const draftByShortName = new Map(draftShiftTypes.map((shiftType) => [shiftType.shortName.toUpperCase(), shiftType]));
    const parsedByShortName = new Map(
        parsedShiftTypes
            .map((shiftType) => [normalizeShiftShortName(shiftType.shortName), shiftType] as const)
            .filter((entry): entry is [string, TOnboardingParsedShiftType] => Boolean(entry[0])),
    );

    const usedShortNames = new Set<string>();
    const nextShiftTypes = CORE_SHIFT_SHORT_NAMES.map((shortName, index) => {
        usedShortNames.add(shortName);
        return parsedByShortName.has(shortName)
            ? toDraftShiftType(parsedByShortName.get(shortName)!, index)
            : {...(draftByShortName.get(shortName) ?? toDraftShiftType(createCoreParsedShiftType(shortName), index))};
    });

    parsedShiftTypes.forEach((shiftType) => {
        const shortName = normalizeShiftShortName(shiftType.shortName);

        if (!shortName || usedShortNames.has(shortName)) {
            return;
        }

        usedShortNames.add(shortName);
        nextShiftTypes.push(toDraftShiftType(shiftType, nextShiftTypes.length));
    });

    return normalizeUploadedShiftTypes(nextShiftTypes);
};
const buildDraftTeams = (names: string[]): TOnboardingTeamDraft[] =>
    names.map((name, index) => ({
        id: createLocalId(`team-${index + 1}`),
        name,
    }));
const remapPossibleShiftTypeIds = (
    nurses: TOnboardingNurseDraft[],
    _prevShiftTypes: TOnboardingWardShiftType[],
    nextShiftTypes: TOnboardingWardShiftType[],
): TOnboardingNurseDraft[] => {
    const defaultShiftTypeIds = nextShiftTypes.map((shiftType) => shiftType.id);

    return nurses.map((nurse) => ({
        ...nurse,
        possibleShiftTypeIds: defaultShiftTypeIds,
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
    }));
};
const buildParsedTeams = (parsed: TOnboardingParsedWardData): TOnboardingTeamDraft[] | null => {
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
    const defaultShiftTypeIds = shiftTypes.map((shiftType) => shiftType.id);
    const fallbackTeamId = requireFirstTeamId(teams);

    return parsedNurses.map((nurse, index) => {
        return {
            id: createLocalId(`nurse-${index + 1}`),
            teamId: teamIdByName.get(nurse.teamName?.trim() ?? '') ?? fallbackTeamId,
            name: nurse.name ?? '',
            memo: nurse.memo ?? '',
            isWorker: nurse.isWorker ?? true,
            employmentDate: nurse.employmentDate ?? getTodayDate(),
            possibleShiftTypeIds: defaultShiftTypeIds,
            level: nurse.level ?? null,
            initialShifts: nurse.initialShifts ?? [],
        };
    });
};
const collectWarnings = (response: TOnboardingWardParseApiResponse) =>
    [
        ...(response.warnings ?? []),
        ...(response.quality_report?.warnings ?? []),
        ...(response.blocking_questions ?? []),
        ...(response.failedSheets ?? []).map((sheetName) => `시트 "${sheetName}" 데이터를 불러오지 못했어요.`),
        ...(response.failedRows ?? []).map((rowLabel) => `일부 행(${rowLabel})을 해석하지 못해 제외했어요.`),
    ].filter((warning): warning is string => Boolean(warning?.trim()));
const collectResponseObservedShiftCodes = (response: TOnboardingWardParseApiResponse) => {
    const shiftCodes = new Set<string>();

    response.nurses?.forEach((nurse) => {
        nurse.possibleShiftShortNames
            ?.map((shortName) => normalizeShiftShortName(shortName))
            .filter((shortName): shortName is string => Boolean(shortName))
            .forEach((shortName) => shiftCodes.add(shortName));

        collectObservedWorkShiftCodes(nurse.assignments).forEach((shortName) => shiftCodes.add(shortName));
    });

    response.nurse_candidates?.forEach((nurse) => {
        collectObservedWorkShiftCodes(nurse.assignments, nurse.monthly_counts).forEach((shortName) => shiftCodes.add(shortName));
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

        existingShortNames.add(shortName);
        nextShiftTypes.push(
            CORE_SHIFT_SHORT_NAMES.includes(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number])
                ? createCoreParsedShiftType(shortName as (typeof CORE_SHIFT_SHORT_NAMES)[number])
                : {
                      name: getShiftTypeNameFromShortName(shortName),
                      shortName,
                      color: getOnboardingShiftCodeColor(shortName),
                      isDefault: false,
                      isOff: false,
                      classification: inferClassificationFromShortName(shortName, false),
                  },
        );
    });

    return nextShiftTypes;
};
const normalizeParsedShiftTypes = (response: TOnboardingWardParseApiResponse): TOnboardingParsedShiftType[] | undefined => {
    const rawShiftTypes = response.shiftTypes ?? response.wardShiftTypes;
    const observedShiftCodes = collectResponseObservedShiftCodes(response);

    if (rawShiftTypes) {
        return appendObservedShiftTypes(
            rawShiftTypes
                .map((shiftType) => ({
                    name: trimToUndefined(shiftType.name),
                    shortName: normalizeShiftShortName(shiftType.shortName),
                    startTime: trimToUndefined(shiftType.startTime),
                    endTime: trimToUndefined(shiftType.endTime),
                    color: trimToUndefined(shiftType.color),
                    isDefault: shiftType.isDefault ?? undefined,
                    isOff: shiftType.isOff ?? undefined,
                    classification: shiftType.classification ?? undefined,
                }))
                .filter((shiftType) => Boolean(shiftType.name ?? shiftType.shortName)),
            observedShiftCodes,
        );
    }

    if (!response.shift_type_candidates) {
        return observedShiftCodes.length > 0 ? appendObservedShiftTypes([], observedShiftCodes) : undefined;
    }

    return appendObservedShiftTypes(
        response.shift_type_candidates
            .map((candidate) => {
                const shortName = normalizeShiftShortName(candidate.code);
                const classification = shortName ? normalizeShiftClassification(candidate.classification, shortName) : undefined;

                return {
                    name: shortName ? getShiftTypeNameFromShortName(shortName) : undefined,
                    shortName,
                    color: shortName && !['D', 'E', 'N', 'O'].includes(shortName) ? getOnboardingShiftCodeColor(shortName) : undefined,
                    isDefault: ['D', 'E', 'N', 'O'].includes(shortName ?? ''),
                    isOff: classification === 'OFF' || shortName === 'O',
                    classification,
                };
            })
            .filter((shiftType) => Boolean(shiftType.name ?? shiftType.shortName)),
        observedShiftCodes,
    );
};
const normalizeParsedTeams = (response: TOnboardingWardParseApiResponse): TOnboardingParsedTeam[] | undefined => {
    const rawTeams = response.teams ?? response.shiftTeams;

    if (!rawTeams) {
        return undefined;
    }

    return rawTeams.map((team) => ({name: trimToUndefined(team.name) ?? ''})).filter((team) => Boolean(team.name));
};
const normalizeParsedNurses = (
    response: TOnboardingWardParseApiResponse,
    options?: TOnboardingWardParseOptions,
): TOnboardingParsedNurse[] | undefined => {
    if (response.nurses) {
        return response.nurses
            .map((nurse) =>
                compactParsedNurse({
                    name: trimToUndefined(nurse.name),
                    memo: nurse.memo ?? undefined,
                    isWorker: nurse.isWorker ?? undefined,
                    employmentDate: trimToUndefined(nurse.employmentDate),
                    level: nurse.level ?? undefined,
                    teamName: trimToUndefined(nurse.teamName),
                    possibleShiftShortNames:
                        nurse.possibleShiftShortNames
                            ?.map((shortName) => normalizeShiftShortName(shortName))
                            .filter((shortName): shortName is string => Boolean(shortName)) ?? undefined,
                    initialShifts: normalizeInitialShifts(nurse.assignments, options),
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
                possibleShiftShortNames: collectObservedWorkShiftCodes(nurse.assignments, nurse.monthly_counts),
                initialShifts: normalizeInitialShifts(nurse.assignments, options),
            }),
        )
        .filter((nurse) => Boolean(nurse.name));
};
const normalizeConstraintSeverity = (severityRecommendation: string | null | undefined): TShiftConstraintSeverity | undefined => {
    const normalized = severityRecommendation?.trim().toUpperCase();

    if (!normalized) return undefined;

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
const buildConstraintRulePayloads = (draft: TOnboardingWardDraft) =>
    draft.constraintCandidates
        .filter((constraint) => constraint.selected && constraint.templateCode)
        .map((constraint) => ({
            templateCode: constraint.templateCode,
            severity: constraint.severity,
            selected: constraint.selected,
            params: constraint.params,
        }));

export const getOnboardingUploadExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

export const isSupportedOnboardingUploadFile = (fileName: string) =>
    SUPPORTED_ONBOARDING_UPLOAD_EXTENSIONS.includes(
        getOnboardingUploadExtension(fileName) as (typeof SUPPORTED_ONBOARDING_UPLOAD_EXTENSIONS)[number],
    );

export const getOnboardingUploadFailureMessage = (error: unknown) => {
    const defaultMessage = '파일을 해석하지 못했어요. 엑셀 양식을 확인한 뒤 다시 업로드해 주세요.';
    const message = error instanceof Error ? error.message.trim() : '';

    if (!message) {
        return defaultMessage;
    }

    if (message.includes('Network Error')) {
        return '파싱 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
    }

    return message;
};

export const buildOnboardingParseDraftInjection = (
    response: TOnboardingWardParseApiResponse,
    uploadedFileName: string,
    options?: TOnboardingWardParseOptions,
): TOnboardingParseDraftInjection => ({
    parsedWardData: {
        fileName: trimToUndefined(response.fileName) ?? uploadedFileName,
        wardName: trimToUndefined(response.wardName),
        hospitalName: trimToUndefined(response.hospitalName),
        shiftTypes: normalizeParsedShiftTypes(response),
        teams: normalizeParsedTeams(response),
        nurses: normalizeParsedNurses(response, options),
        constraintCandidates: normalizeParsedConstraintCandidates(response),
    },
    warnings: collectWarnings(response),
});

export const applyParsedWardData = (draft: TOnboardingWardDraft, parsed: TOnboardingParsedWardData): TOnboardingWardDraft => {
    const nextShiftTypes = parsed.shiftTypes
        ? ensureCoreShiftTypes(draft.shiftTypes, parsed.shiftTypes)
        : normalizeUploadedShiftTypes(draft.shiftTypes);
    const nextTeams = buildParsedTeams(parsed) ?? draft.teams;
    const nextNurses = parsed.nurses
        ? buildParsedNurses(parsed.nurses, nextTeams, nextShiftTypes)
        : remapTeamIds(remapPossibleShiftTypeIds(draft.nurses, draft.shiftTypes, nextShiftTypes), draft.teams, nextTeams);

    return {
        ...draft,
        uploadedFileName: parsed.fileName ?? draft.uploadedFileName,
        wardName: parsed.wardName ?? draft.wardName,
        hospitalName: parsed.hospitalName ?? draft.hospitalName,
        shiftTypes: nextShiftTypes,
        teams: nextTeams,
        nurses: nextNurses,
        constraintCandidates: parsed.constraintCandidates
            ? parsed.constraintCandidates.map(toDraftConstraintCandidate)
            : draft.constraintCandidates,
        skillLevelConfig: parsed.skillLevelConfig ? {...draft.skillLevelConfig, ...parsed.skillLevelConfig} : draft.skillLevelConfig,
    };
};

export const buildCreateWardPayload = (draft: TOnboardingWardDraft): TCreateWardDTO => {
    const normalizedWardName = draft.wardName.trim();
    const normalizedHospitalName = draft.hospitalName.trim();
    const fallbackName = normalizedWardName || normalizedHospitalName || '듀팅 병동';
    const shiftTypeById = new Map(draft.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
    const constraintRules = buildConstraintRulePayloads(draft);

    return {
        name: normalizedWardName || normalizedHospitalName || fallbackName,
        hospitalName: normalizedHospitalName || normalizedWardName || fallbackName,
        wardShiftTypes: draft.shiftTypes.map(({id: _id, ...shiftType}) => shiftType),
        shiftTeams: draft.teams.map((team) => {
            const nurses = draft.nurses
                .filter((nurse) => nurse.teamId === team.id)
                .map((nurse) => ({
                    ...nurse,
                    requestName: normalizeNurseNameForRequest(nurse.name),
                }))
                .filter((nurse) => nurse.requestName);

            return {
                name: team.name,
                nurseNames: nurses.map((nurse) => nurse.requestName),
                constraintRules: constraintRules.length > 0 ? constraintRules : undefined,
                nurses: nurses.map((nurse) => ({
                    name: nurse.requestName,
                    memo: nurse.memo,
                    isWorker: nurse.isWorker,
                    employmentDate: nurse.employmentDate,
                    level: nurse.level,
                    isPreceptor: nurse.memo.trim() === '프리셉터',
                    isPreceptee: nurse.memo.trim() === '프리셉티',
                    possibleShiftShortNames: nurse.possibleShiftTypeIds
                        .map((shiftTypeId) => shiftTypeById.get(shiftTypeId)?.shortName)
                        .filter((shortName): shortName is string => Boolean(shortName)),
                    initialShifts: (nurse.initialShifts ?? []).length > 0 ? nurse.initialShifts : undefined,
                })),
            };
        }),
    };
};
