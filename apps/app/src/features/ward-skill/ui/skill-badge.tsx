import {cn} from '@dutying/utils/style';
import {getSkillLevelBadgeStyle, type TSkillLevelConfig} from '../model/skill-level';

interface ISkillBadgeProps {
    level: number | null | undefined;
    config: TSkillLevelConfig;
    className?: string;
}

function SkillBadge({level, config, className = ''}: ISkillBadgeProps) {
    const safeLevel = Math.max(1, Math.min(config.levelCount, level ?? config.levelCount));
    const {background, text} = getSkillLevelBadgeStyle(safeLevel);

    return (
        <div
            className={cn(
                'inline-flex min-h-5 min-w-10 items-center justify-center rounded-[4px] px-2 py-0.5 font-apple text-[11px] font-semibold leading-none tabular-nums',
                className,
            )}
            style={{backgroundColor: background, color: text}}
        >
            LV. {safeLevel}
        </div>
    );
}

export default SkillBadge;
