import {cn} from '@dutying/utils/style';
import {getSkillPalette, type TSkillLevelConfig} from '../model/skill-level';

interface ISkillBadgeProps {
    level: number | null | undefined;
    config: TSkillLevelConfig;
    className?: string;
}

function SkillBadge({level, config, className = ''}: ISkillBadgeProps) {
    const palette = getSkillPalette(config.paletteId);
    const safeLevel = Math.max(1, Math.min(config.levelCount, level ?? config.levelCount));
    const color = palette.colors[safeLevel - 1] ?? palette.colors[palette.colors.length - 1];
    const textColor =
        safeLevel >= config.levelCount
            ? '#C52F18'
            : safeLevel >= Math.max(2, config.levelCount - 1)
              ? '#D64732'
              : safeLevel === 1
                ? '#DAAB4C'
                : '#B95F0E';

    return (
        <div
            className={cn(
                'inline-flex h-5 min-w-11 items-center justify-center rounded-[3px] px-1.5 font-poppins text-[14px] font-medium',
                className,
            )}
            style={{backgroundColor: color, color: textColor}}
        >
            LV. {safeLevel}
        </div>
    );
}

export default SkillBadge;
