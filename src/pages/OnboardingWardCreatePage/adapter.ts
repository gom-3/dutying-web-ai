import {type TCreateWardDTO} from '@/shared/api/ward/type';
import {
    createEmptyShiftType,
    getSkillPalette,
    type TOnboardingNurseDraft,
    type TOnboardingTeamDraft,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
    type TSkillLevelConfig,
} from './model';

export type TMockCreateWardPayload = TCreateWardDTO & {
    nurses: Array<{
        name: string;
        memo: string;
        isWorker: boolean;
        employmentDate: string;
        teamName: string;
        level: number | null;
        possibleShiftShortNames: string[];
    }>;
    skillLevelConfig: TSkillLevelConfig & {
        palette: string[];
    };
};

export type TOnboardingParsedShiftType = Partial<Omit<TCreateWardDTO['wardShiftTypes'][number], 'isCounted'>> & {
    name?: string;
    shortName?: string;
};

export type TOnboardingParsedTeam = {
    name: string;
};

export type TOnboardingParsedNurse = Partial<Pick<TOnboardingNurseDraft, 'name' | 'memo' | 'isWorker' | 'employmentDate' | 'level'>> & {
    teamName?: string;
    possibleShiftShortNames?: string[];
};

export type TOnboardingParsedWardData = {
    fileName?: string;
    wardName?: string;
    hospitalName?: string;
    shiftTypes?: TOnboardingParsedShiftType[];
    teams?: TOnboardingParsedTeam[];
    nurses?: TOnboardingParsedNurse[];
    skillLevelConfig?: Partial<TSkillLevelConfig>;
};

const createLocalId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalizeUploadedShiftTypes = (shiftTypes: TOnboardingWardShiftType[]): TOnboardingWardShiftType[] =>
    shiftTypes.map((shiftType) =>
        shiftType.shortName === 'D'
            ? {...shiftType, startTime: '07:00', endTime: '15:00'}
            : shiftType.shortName === 'E'
              ? {...shiftType, startTime: '15:00', endTime: '23:00'}
              : shiftType.shortName === 'N'
                ? {...shiftType, startTime: '23:00', endTime: '07:00'}
                : shiftType,
    );
const toDraftShiftType = (parsed: TOnboardingParsedShiftType): TOnboardingWardShiftType => {
    const base = createEmptyShiftType();

    return {
        ...base,
        id: createLocalId('shift'),
        name: parsed.name ?? base.name,
        shortName: parsed.shortName ?? base.shortName,
        startTime: parsed.startTime ?? base.startTime,
        endTime: parsed.endTime ?? base.endTime,
        color: parsed.color ?? base.color,
        isDefault: parsed.isDefault ?? false,
        isOff: parsed.isOff ?? false,
        classification: parsed.classification ?? (parsed.isOff ? 'OFF' : base.classification),
    };
};
const buildDraftTeams = (names: string[]): TOnboardingTeamDraft[] =>
    names.map((name, index) => ({
        id: createLocalId(`team-${index + 1}`),
        name,
    }));
const remapPossibleShiftTypeIds = (
    nurses: TOnboardingNurseDraft[],
    prevShiftTypes: TOnboardingWardShiftType[],
    nextShiftTypes: TOnboardingWardShiftType[],
): TOnboardingNurseDraft[] => {
    const prevShortNameById = new Map(prevShiftTypes.map((shiftType) => [shiftType.id, shiftType.shortName]));
    const nextIdByShortName = new Map(nextShiftTypes.map((shiftType) => [shiftType.shortName, shiftType.id]));
    const defaultShiftTypeIds = nextShiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id);

    return nurses.map((nurse) => {
        const nextPossibleShiftTypeIds = nurse.possibleShiftTypeIds
            .map((shiftTypeId) => prevShortNameById.get(shiftTypeId))
            .map((shortName) => (shortName ? nextIdByShortName.get(shortName) : undefined))
            .filter((shiftTypeId): shiftTypeId is string => Boolean(shiftTypeId));

        return {
            ...nurse,
            possibleShiftTypeIds: nextPossibleShiftTypeIds.length > 0 ? nextPossibleShiftTypeIds : defaultShiftTypeIds,
        };
    });
};
const remapTeamIds = (
    nurses: TOnboardingNurseDraft[],
    prevTeams: TOnboardingTeamDraft[],
    nextTeams: TOnboardingTeamDraft[],
): TOnboardingNurseDraft[] => {
    const prevTeamNameById = new Map(prevTeams.map((team) => [team.id, team.name]));
    const nextTeamIdByName = new Map(nextTeams.map((team) => [team.name, team.id]));
    const fallbackTeamId = nextTeams[0]?.id ?? '';

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
    const shiftIdByShortName = new Map(shiftTypes.map((shiftType) => [shiftType.shortName, shiftType.id]));
    const defaultShiftTypeIds = shiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id);
    const fallbackTeamId = teams[0]?.id ?? '';

    return parsedNurses.map((nurse, index) => ({
        id: createLocalId(`nurse-${index + 1}`),
        teamId: teamIdByName.get(nurse.teamName?.trim() ?? '') ?? fallbackTeamId,
        name: nurse.name ?? '',
        memo: nurse.memo ?? '',
        isWorker: nurse.isWorker ?? true,
        employmentDate: nurse.employmentDate ?? '2024-01-01',
        possibleShiftTypeIds:
            nurse.possibleShiftShortNames
                ?.map((shortName) => shiftIdByShortName.get(shortName))
                .filter((shiftTypeId): shiftTypeId is string => Boolean(shiftTypeId)) ?? defaultShiftTypeIds,
        level: nurse.level ?? null,
    }));
};

export const applyParsedWardData = (draft: TOnboardingWardDraft, parsed: TOnboardingParsedWardData): TOnboardingWardDraft => {
    const nextShiftTypes = parsed.shiftTypes
        ? normalizeUploadedShiftTypes(parsed.shiftTypes.map(toDraftShiftType))
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
        skillLevelConfig: parsed.skillLevelConfig ? {...draft.skillLevelConfig, ...parsed.skillLevelConfig} : draft.skillLevelConfig,
    };
};

export const buildCreateWardPayload = (draft: TOnboardingWardDraft): TCreateWardDTO => ({
    name: draft.wardName,
    hospitalName: draft.hospitalName,
    wardShiftTypes: draft.shiftTypes.map(({id: _id, ...shiftType}) => shiftType),
    shiftTeams: draft.teams.map((team) => ({
        nurseNames: draft.nurses.filter((nurse) => nurse.teamId === team.id).map((nurse) => nurse.name),
    })),
});

export const buildMockCreateWardPayload = (draft: TOnboardingWardDraft): TMockCreateWardPayload => {
    const teamById = new Map(draft.teams.map((team) => [team.id, team.name]));
    const shiftTypeById = new Map(draft.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
    const palette = getSkillPalette(draft.skillLevelConfig.paletteId);

    return {
        ...buildCreateWardPayload(draft),
        nurses: draft.nurses.map((nurse) => ({
            name: nurse.name,
            memo: nurse.memo,
            isWorker: nurse.isWorker,
            employmentDate: nurse.employmentDate,
            teamName: teamById.get(nurse.teamId) ?? '',
            level: nurse.level,
            possibleShiftShortNames: nurse.possibleShiftTypeIds
                .map((shiftTypeId) => shiftTypeById.get(shiftTypeId)?.shortName ?? '')
                .filter(Boolean),
        })),
        skillLevelConfig: {
            ...draft.skillLevelConfig,
            palette: palette.colors,
        },
    };
};
