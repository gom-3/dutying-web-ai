import {useMemo} from 'react';
import {type TShift} from '@/entities';
import {
    clampSkillLevel,
    getWardSkillSettings,
    resolveWardSkillLevels,
    type TSkillLevelConfig,
    type TSkillLevelValue,
} from '@/features/ward-skill/model/skill-level';
import {useMakeShiftStore} from '../../../model/make-shift-store';

type TSkillColumnConfig = {
    config: TSkillLevelConfig;
    levelsByNurseId: Record<number, TSkillLevelValue>;
};

type TShiftNurseWithSkill = TShift['divisionShiftNurses'][number][number]['shiftNurse'] & {
    employmentDate?: string | null;
    level?: number | null;
    proficiency?: number | null;
};

function getVisibleShiftNurses(shift: TShift | null | undefined): TShiftNurseWithSkill[] {
    return (shift?.divisionShiftNurses ?? []).flatMap((division) => division.map((row) => row.shiftNurse as TShiftNurseWithSkill));
}

function getExplicitSkillLevel(nurse: TShiftNurseWithSkill, levelCount: number): number | null {
    const rawLevel = typeof nurse.proficiency === 'number' ? nurse.proficiency : typeof nurse.level === 'number' ? nurse.level : null;

    if (rawLevel === null || !Number.isFinite(rawLevel)) return null;

    return clampSkillLevel(rawLevel, levelCount);
}

export function useMakeShiftSkillColumn(shift: TShift | null | undefined): TSkillColumnConfig {
    const wardId = useMakeShiftStore((s) => s.wardId);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const visibleShiftNurses = useMemo(() => getVisibleShiftNurses(shift), [shift]);
    const skillSettings = useMemo(() => getWardSkillSettings(wardId), [wardId]);
    const allWardNurses = useMemo(() => {
        const nurses = shiftTeams.flatMap((team) => team.nurses ?? []);

        if (nurses.length > 0) return nurses;

        return visibleShiftNurses.map((nurse) => ({
            nurseId: nurse.nurseId,
            employmentDate: nurse.employmentDate ?? '',
        }));
    }, [shiftTeams, visibleShiftNurses]);
    const {config, levelsByNurseId} = useMemo(() => resolveWardSkillLevels(allWardNurses, skillSettings), [allWardNurses, skillSettings]);
    const explicitLevelsByNurseId = useMemo(
        () =>
            visibleShiftNurses.reduce<Record<number, TSkillLevelValue>>((acc, nurse) => {
                const level = getExplicitSkillLevel(nurse, config.levelCount);

                if (level !== null) {
                    acc[nurse.nurseId] = level;
                }

                return acc;
            }, {}),
        [config.levelCount, visibleShiftNurses],
    );

    return useMemo(
        () => ({
            config,
            levelsByNurseId: {...levelsByNurseId, ...explicitLevelsByNurseId},
        }),
        [config, explicitLevelsByNurseId, levelsByNurseId],
    );
}
