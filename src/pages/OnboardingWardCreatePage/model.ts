import {type DropResult} from '@hello-pangea/dnd';
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

export type TOnboardingValidationIssueCode =
    | 'empty-shift-types'
    | 'missing-shift-name'
    | 'missing-shift-short-name'
    | 'missing-shift-time'
    | 'empty-team'
    | 'empty-team-nurses'
    | 'missing-nurse-name';

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
    {id: 'warm', colors: ['#FFA395', '#FFC0B6', '#FFC795', '#FFE195', '#FFF0B0']},
    {id: 'cool', colors: ['#9EC5FF', '#B7D6FF', '#CFE4FF', '#DFF0FF', '#ECF8FF']},
    {id: 'violet', colors: ['#B18FFF', '#C8AEFF', '#D8C4FF', '#E9DCFF', '#F3EBFF']},
];
const DEFAULT_SKILL_LEVEL_CONFIG: TSkillLevelConfig = {
    levelCount: 5,
    paletteId: 'warm',
    autoAssign: true,
};
const MIN_STEP = 1;
const MAX_STEP = 4;
const REQUIRED_COMPLETION_STEPS: TOnboardingStep[] = [2, 3, 4];

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

export const updateShiftTypeDraft = (
    draft: TOnboardingWardDraft,
    shiftTypeId: string,
    updater: Partial<TOnboardingWardShiftType>,
): TOnboardingWardDraft => ({
    ...draft,
    shiftTypes: draft.shiftTypes.map((shiftType) => (shiftType.id === shiftTypeId ? {...shiftType, ...updater} : shiftType)),
});

export const addShiftTypeDraft = (draft: TOnboardingWardDraft): TOnboardingWardDraft => ({
    ...draft,
    shiftTypes: [...draft.shiftTypes, createEmptyShiftType()],
});

export const deleteShiftTypeDraft = (draft: TOnboardingWardDraft, shiftTypeId: string): TOnboardingWardDraft => ({
    ...draft,
    shiftTypes: draft.shiftTypes.filter((shiftType) => shiftType.id !== shiftTypeId),
    nurses: draft.nurses.map((nurse) => ({
        ...nurse,
        possibleShiftTypeIds: nurse.possibleShiftTypeIds.filter((value) => value !== shiftTypeId),
    })),
});

export const updateNurseDraft = (
    draft: TOnboardingWardDraft,
    nurseId: string,
    updater: Partial<TOnboardingNurseDraft>,
): TOnboardingWardDraft => ({
    ...draft,
    nurses: draft.nurses.map((nurse) => (nurse.id === nurseId ? {...nurse, ...updater} : nurse)),
});

export const addTeamDraft = (draft: TOnboardingWardDraft) => {
    const team = {
        id: `team-new-${draft.teams.length + 1}`,
        name: `간호사 ${draft.teams.length + 1}팀`,
    };

    return {
        draft: {
            ...draft,
            teams: [...draft.teams, team],
        },
        addedTeamId: team.id,
    };
};

export const addNurseDraft = (draft: TOnboardingWardDraft, teamId: string): TOnboardingWardDraft => {
    if (!teamId) {
        return draft;
    }

    return {
        ...draft,
        nurses: [...draft.nurses, createEmptyNurse(teamId, draft.shiftTypes)],
    };
};

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

export const saveSkillLevelConfig = (draft: TOnboardingWardDraft, config: TSkillLevelConfig): TOnboardingWardDraft => ({
    ...draft,
    skillLevelConfig: config,
    nurses: applySkillLevels(draft.nurses, config),
});

const validateShiftTypes = (draft: TOnboardingWardDraft): TOnboardingValidationIssue[] => {
    const issues: TOnboardingValidationIssue[] = [];

    if (draft.shiftTypes.length === 0) {
        issues.push({code: 'empty-shift-types', step: 2});
    }

    draft.shiftTypes.forEach((shiftType) => {
        if (!shiftType.name.trim()) {
            issues.push({code: 'missing-shift-name', step: 2, targetId: shiftType.id});
        }

        if (!shiftType.shortName.trim()) {
            issues.push({code: 'missing-shift-short-name', step: 2, targetId: shiftType.id});
        }

        if (!shiftType.isOff && (!shiftType.startTime.trim() || !shiftType.endTime.trim())) {
            issues.push({code: 'missing-shift-time', step: 2, targetId: shiftType.id});
        }
    });

    return issues;
};

const validateTeamsAndNurses = (draft: TOnboardingWardDraft, step: 3 | 4): TOnboardingValidationIssue[] => {
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
            }
        });
    });

    return issues;
};

export const getStepValidation = (draft: TOnboardingWardDraft, step = draft.currentStep): TOnboardingStepValidation => {
    let issues: TOnboardingValidationIssue[] = [];

    switch (step) {
        case 1:
            issues = [];
            break;
        case 2:
            issues = validateShiftTypes(draft);
            break;
        case 3:
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

export const canGoNext = (draft: TOnboardingWardDraft): boolean =>
    draft.currentStep < MAX_STEP && getStepValidation(draft).isValid;

export const canComplete = (draft: TOnboardingWardDraft): boolean =>
    draft.currentStep === MAX_STEP && REQUIRED_COMPLETION_STEPS.every((step) => getStepValidation(draft, step).isValid);

export const getActionState = (draft: TOnboardingWardDraft): TOnboardingActionState => ({
    canGoPrev: canGoPrev(draft),
    canGoNext: canGoNext(draft),
    canComplete: canComplete(draft),
});

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
