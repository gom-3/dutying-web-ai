import {type TCreateWardDTO} from '@/shared/api/ward/type';

export type TOnboardingStep = 1 | 2 | 3 | 4;

export type TOnboardingWardShiftType = TCreateWardDTO['wardShiftTypes'][number] & {
    id: string;
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
    isWorker: boolean;
    employmentDate: string;
    possibleShiftTypeIds: string[];
    level: number | null;
};

export type TSkillPalette = {
    id: string;
    colors: string[];
};

export type TSkillLevelConfig = {
    levelCount: number;
    paletteId: string;
    autoAssign: boolean;
};

export type TOnboardingWardDraft = {
    currentStep: TOnboardingStep;
    uploadedFileName: string | null;
    wardName: string;
    hospitalName: string;
    shiftTypes: TOnboardingWardShiftType[];
    teams: TOnboardingTeamDraft[];
    nurses: TOnboardingNurseDraft[];
    skillLevelConfig: TSkillLevelConfig;
};

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

const SKILL_PALETTES: TSkillPalette[] = [
    {id: 'warm', colors: ['#FFA395', '#FFC0B6', '#FFC795', '#FFE195', '#FFF0B0']},
    {id: 'cool', colors: ['#9EC5FF', '#B7D6FF', '#CFE4FF', '#DFF0FF', '#ECF8FF']},
    {id: 'violet', colors: ['#B18FFF', '#C8AEFF', '#D8C4FF', '#E9DCFF', '#F3EBFF']},
];
const DEFAULT_SKILL_LEVEL_CONFIG: TSkillLevelConfig = {
    levelCount: 5,
    paletteId: 'warm',
    autoAssign: true,
};

let nextId = 0;

const createId = (prefix: string) => `${prefix}-${nextId++}`;
const createShiftType = (
    input: Omit<TOnboardingWardShiftType, 'id'> & {
        id?: string;
    },
): TOnboardingWardShiftType => ({
    id: input.id ?? createId('shift'),
    ...input,
});
const createNurse = (
    input: Omit<TOnboardingNurseDraft, 'id'> & {
        id?: string;
    },
): TOnboardingNurseDraft => ({
    id: input.id ?? createId('nurse'),
    ...input,
});
const BASE_SHIFT_TYPES = [
    createShiftType({
        name: '데이',
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#4DC2AD',
        isDefault: true,
        isOff: false,
        classification: 'DAY',
    }),
    createShiftType({
        name: '이브닝',
        shortName: 'E',
        startTime: '15:00',
        endTime: '23:00',
        color: '#FF8BA5',
        isDefault: true,
        isOff: false,
        classification: 'EVENING',
    }),
    createShiftType({
        name: '나이트',
        shortName: 'N',
        startTime: '23:00',
        endTime: '07:00',
        color: '#3580FF',
        isDefault: true,
        isOff: false,
        classification: 'NIGHT',
    }),
    createShiftType({
        name: '오프',
        shortName: 'O',
        startTime: '',
        endTime: '',
        color: '#465B7A',
        isDefault: true,
        isOff: true,
        classification: 'OFF',
    }),
];
const BASE_TEAMS: TOnboardingTeamDraft[] = [
    {id: createId('team'), name: '간호사 1팀'},
    {id: createId('team'), name: '간호사 2팀'},
    {id: createId('team'), name: '간호사 3팀'},
];
const createBaseNurses = (shiftTypes: TOnboardingWardShiftType[], teams: TOnboardingTeamDraft[]) => {
    const shiftTypeIds = shiftTypes.map((shiftType) => shiftType.id);
    const firstTeamId = teams[0]?.id ?? '';

    return [
        createNurse({
            teamId: firstTeamId,
            name: '홍길동',
            memo: '프리셉터',
            isWorker: true,
            employmentDate: '2019-03-01',
            possibleShiftTypeIds: shiftTypeIds,
            level: 5,
        }),
        createNurse({
            teamId: firstTeamId,
            name: '김하늘',
            memo: '',
            isWorker: true,
            employmentDate: '2020-07-15',
            possibleShiftTypeIds: shiftTypeIds,
            level: 4,
        }),
        createNurse({
            teamId: firstTeamId,
            name: '박연우',
            memo: '',
            isWorker: false,
            employmentDate: '2022-02-01',
            possibleShiftTypeIds: shiftTypeIds,
            level: 3,
        }),
        createNurse({
            teamId: firstTeamId,
            name: '이서윤',
            memo: '나이트킵',
            isWorker: true,
            employmentDate: '2023-10-10',
            possibleShiftTypeIds: shiftTypeIds,
            level: 2,
        }),
    ];
};

export const skillPalettes = SKILL_PALETTES;

export const getSkillPalette = (paletteId: string) => skillPalettes.find((palette) => palette.id === paletteId) ?? skillPalettes[0];

export const createEmptyShiftType = (): TOnboardingWardShiftType =>
    createShiftType({
        name: '',
        shortName: '',
        startTime: '09:00',
        endTime: '18:00',
        color: '#BFC7D4',
        isDefault: false,
        isOff: false,
        classification: 'OTHER_WORK',
    });

export const createEmptyNurse = (teamId: string, shiftTypes: TOnboardingWardShiftType[]): TOnboardingNurseDraft =>
    createNurse({
        teamId,
        name: `신규 간호사 ${nextId + 1}`,
        memo: '',
        isWorker: true,
        employmentDate: '2024-01-01',
        possibleShiftTypeIds: shiftTypes.filter((shiftType) => !shiftType.isOff).map((shiftType) => shiftType.id),
        level: null,
    });

export const createInitialDraft = (): TOnboardingWardDraft => {
    const shiftTypes = BASE_SHIFT_TYPES.map((shiftType) => ({...shiftType}));
    const teams = BASE_TEAMS.map((team) => ({...team}));
    const nurses = createBaseNurses(shiftTypes, teams);

    return {
        currentStep: 1,
        uploadedFileName: null,
        wardName: '듀팅 병동',
        hospitalName: '듀팅 병원',
        shiftTypes,
        teams,
        nurses: applySkillLevels(nurses, DEFAULT_SKILL_LEVEL_CONFIG),
        skillLevelConfig: DEFAULT_SKILL_LEVEL_CONFIG,
    };
};

export const applyMockUpload = (draft: TOnboardingWardDraft, fileName: string): TOnboardingWardDraft => ({
    ...draft,
    uploadedFileName: fileName,
    shiftTypes: draft.shiftTypes.map((shiftType) =>
        shiftType.shortName === 'D'
            ? {...shiftType, startTime: '07:00', endTime: '15:00'}
            : shiftType.shortName === 'E'
              ? {...shiftType, startTime: '15:00', endTime: '23:00'}
              : shiftType.shortName === 'N'
                ? {...shiftType, startTime: '23:00', endTime: '07:00'}
                : shiftType,
    ),
});

export const applySkillLevels = (nurses: TOnboardingNurseDraft[], config: TSkillLevelConfig): TOnboardingNurseDraft[] => {
    const levelCount = Math.min(Math.max(config.levelCount, 2), 5);

    if (!config.autoAssign) {
        return nurses.map((nurse) => ({
            ...nurse,
            level: nurse.level ? Math.min(nurse.level, levelCount) : levelCount,
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

export const serializeDraft = (draft: TOnboardingWardDraft): TMockCreateWardPayload => {
    const teamById = new Map(draft.teams.map((team) => [team.id, team.name]));
    const shiftTypeById = new Map(draft.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
    const palette = getSkillPalette(draft.skillLevelConfig.paletteId);

    return {
        name: draft.wardName,
        hospitalName: draft.hospitalName,
        wardShiftTypes: draft.shiftTypes.map(({id: _id, ...shiftType}) => shiftType),
        shiftTeams: draft.teams.map((team) => ({
            nurseNames: draft.nurses.filter((nurse) => nurse.teamId === team.id).map((nurse) => nurse.name),
        })),
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
