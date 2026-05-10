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

/**
 * 숙련도 배지(LV.n) 공통 스타일 — 레벨별 배경·글자색 (LV.5 최고 ~ LV.1 최저 그라데이션)
 * paletteId와 무관하게 동일하게 적용한다.
 */
export const SKILL_LEVEL_BADGE_THEME: Record<1 | 2 | 3 | 4 | 5, {background: string; text: string}> = {
    1: {background: '#FFF3B8', text: '#A69A41'},
    2: {background: '#FFE9B8', text: '#A68B41'},
    3: {background: '#FFD8B8', text: '#A66F41'},
    4: {background: '#FFC7B8', text: '#A65241'},
    5: {background: '#FFB3A7', text: '#A63D32'},
};

export function getSkillLevelBadgeStyle(level: number): {background: string; text: string} {
    const clamped = Math.max(1, Math.min(5, Math.round(level))) as keyof typeof SKILL_LEVEL_BADGE_THEME;

    return SKILL_LEVEL_BADGE_THEME[clamped];
}

const STORAGE_KEY = 'ward-skill-settings:v1';
const DEFAULT_UNASSIGNED_SKILL_LEVEL = 1;
const SKILL_PALETTES: TSkillPalette[] = [
    {id: 'warm', colors: ['#FFF3B8', '#FFE9B8', '#FFD8B8', '#FFC7B8', '#FFB3A7']},
    {id: 'cool', colors: ['#FFF3B8', '#FFE9B8', '#FFD8B8', '#FFC7B8', '#FFB3A7']},
    {id: 'violet', colors: ['#FFF3B8', '#FFE9B8', '#FFD8B8', '#FFC7B8', '#FFB3A7']},
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
    /**
     * TODO : null 간호사를 앞/뒤 어디에 배치할지는 정책 판단이 필요합니다
     * TNurse.employmentDate 타입은 string (non-null)으로 선언되어 있음 (packages/domain/src/nurse.ts:29)
     * 그런데 실제 API 응답은 null을 허용 (shared/api/file/type.ts:28에서 employmentDate?: string | null)
     * 입사일이 null인 간호사가 있으면 null.localeCompare(...) 호출로 TypeError 발생
     * 이 에러가 Workers 컴포넌트 렌더링을 터뜨려서 → 빈 페이지로 보임
     */
    const sortedNurses = nurses
        .map((nurse) => ({nurse}))
        .sort((left, right) => {
            const byDate = (left.nurse.employmentDate ?? '').localeCompare(right.nurse.employmentDate ?? '');
            if (byDate !== 0) return byDate;
            /** 동일 입사일때 ward/팀 내 배열 순서(드래그·낙관적 업데이트)에 따라 LV가 뒤바뀌지 않도록 고정한다 */
            return left.nurse.nurseId - right.nurse.nurseId;
        });
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
