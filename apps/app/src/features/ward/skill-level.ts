import {type TNurse} from '@/entities/nurse';

export type TSkillPalette = {
    id: string;
    colors: string[];
};

export type TSkillLevelConfig = {
    levelCount: number;
    paletteId: string;
    autoAssign: boolean;
};

export type TWardSkillSettings = {
    config: TSkillLevelConfig;
    frozenLevelsByNurseId: Record<number, number>;
};

const STORAGE_KEY = 'ward-skill-settings:v1';
const DEFAULT_UNASSIGNED_SKILL_LEVEL = 1;
const SKILL_PALETTES: TSkillPalette[] = [
    {id: 'warm', colors: ['#FFA395', '#FFC0B6', '#FFC795', '#FFE195', '#FFF0B0']},
    {id: 'cool', colors: ['#9EC5FF', '#B7D6FF', '#CFE4FF', '#DFF0FF', '#ECF8FF']},
    {id: 'violet', colors: ['#B18FFF', '#C8AEFF', '#D8C4FF', '#E9DCFF', '#F3EBFF']},
];

export const DEFAULT_SKILL_LEVEL_CONFIG: TSkillLevelConfig = {
    levelCount: 5,
    paletteId: 'warm',
    autoAssign: true,
};

type TSkillLevelNurse = Pick<TNurse, 'nurseId' | 'employmentDate'>;
type TSkillStorage = Record<number, TWardSkillSettings>;

const clampLevelCount = (levelCount: number) => Math.min(Math.max(levelCount, 2), 5);

export const clampSkillLevel = (level: number | null | undefined, levelCount: number) =>
    Math.max(1, Math.min(clampLevelCount(levelCount), level ?? clampLevelCount(levelCount)));

export const skillPalettes = SKILL_PALETTES;

export const getSkillPalette = (paletteId: string) => skillPalettes.find((palette) => palette.id === paletteId) ?? skillPalettes[0];

export const normalizeSkillLevelConfig = (config: Partial<TSkillLevelConfig> | undefined): TSkillLevelConfig => {
    const paletteId = config?.paletteId && skillPalettes.some((palette) => palette.id === config.paletteId) ? config.paletteId : 'warm';

    return {
        levelCount: clampLevelCount(config?.levelCount ?? DEFAULT_SKILL_LEVEL_CONFIG.levelCount),
        paletteId,
        autoAssign: config?.autoAssign ?? DEFAULT_SKILL_LEVEL_CONFIG.autoAssign,
    };
};

export const createAutoAssignedSkillLevels = (nurses: TSkillLevelNurse[], config: TSkillLevelConfig): Record<number, number> => {
    const normalizedConfig = normalizeSkillLevelConfig(config);
    const sortedNurses = nurses
        .map((nurse) => ({nurse}))
        .sort((left, right) => left.nurse.employmentDate.localeCompare(right.nurse.employmentDate));
    const levelsByNurseId: Record<number, number> = {};

    sortedNurses.forEach(({nurse}, index) => {
        const ratio = sortedNurses.length <= 1 ? 0 : index / (sortedNurses.length - 1);
        const level = normalizedConfig.levelCount - Math.round(ratio * (normalizedConfig.levelCount - 1));

        levelsByNurseId[nurse.nurseId] = clampSkillLevel(level, normalizedConfig.levelCount);
    });

    return levelsByNurseId;
};

export const resolveWardSkillLevels = (
    nurses: TSkillLevelNurse[],
    settings: TWardSkillSettings | null | undefined,
): {config: TSkillLevelConfig; levelsByNurseId: Record<number, number>} => {
    const config = normalizeSkillLevelConfig(settings?.config);

    if (config.autoAssign) {
        return {
            config,
            levelsByNurseId: createAutoAssignedSkillLevels(nurses, config),
        };
    }

    const levelsByNurseId = nurses.reduce<Record<number, number>>((acc, nurse) => {
        acc[nurse.nurseId] = clampSkillLevel(
            settings?.frozenLevelsByNurseId?.[nurse.nurseId] ?? DEFAULT_UNASSIGNED_SKILL_LEVEL,
            config.levelCount,
        );

        return acc;
    }, {});

    return {
        config,
        levelsByNurseId,
    };
};

export const createWardSkillSettings = (
    nurses: TSkillLevelNurse[],
    nextConfig: TSkillLevelConfig,
    prevSettings: TWardSkillSettings | null | undefined,
): TWardSkillSettings => {
    const normalizedConfig = normalizeSkillLevelConfig(nextConfig);

    if (normalizedConfig.autoAssign) {
        return {
            config: normalizedConfig,
            frozenLevelsByNurseId: {},
        };
    }

    const currentLevels = resolveWardSkillLevels(nurses, prevSettings).levelsByNurseId;

    return {
        config: normalizedConfig,
        frozenLevelsByNurseId: nurses.reduce<Record<number, number>>((acc, nurse) => {
            acc[nurse.nurseId] = clampSkillLevel(currentLevels[nurse.nurseId], normalizedConfig.levelCount);

            return acc;
        }, {}),
    };
};

const readSkillStorage = (): TSkillStorage => {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return {};
        }

        return JSON.parse(raw) as TSkillStorage;
    } catch {
        return {};
    }
};

export const getWardSkillSettings = (wardId: number | null | undefined): TWardSkillSettings | null => {
    if (!wardId) {
        return null;
    }

    const stored = readSkillStorage()[wardId];

    if (!stored) {
        return null;
    }

    return {
        config: normalizeSkillLevelConfig(stored.config),
        frozenLevelsByNurseId: stored.frozenLevelsByNurseId ?? {},
    };
};

export const saveWardSkillSettings = (wardId: number, settings: TWardSkillSettings) => {
    if (typeof window === 'undefined') {
        return;
    }

    const storage = readSkillStorage();

    storage[wardId] = {
        config: normalizeSkillLevelConfig(settings.config),
        frozenLevelsByNurseId: settings.frozenLevelsByNurseId,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
};

export const getWardSkillSettingsStorageKey = () => STORAGE_KEY;
