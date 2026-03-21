import {getSkillPalette, type TOnboardingWardShiftType, type TSkillLevelConfig} from '../../model';

const SHIFT_BADGE_TEXT_STYLE = 'font-poppins text-[14px] font-medium text-white';

export function ShiftBadge({shiftType}: {shiftType: TOnboardingWardShiftType}) {
    return (
        <div className="flex h-[23px] w-[21px] items-center justify-center rounded-[5px]" style={{backgroundColor: shiftType.color}}>
            <span className={SHIFT_BADGE_TEXT_STYLE}>{shiftType.shortName || '-'}</span>
        </div>
    );
}

export function SkillBadge({level, config}: {level: number | null; config: TSkillLevelConfig}) {
    const palette = getSkillPalette(config.paletteId);
    const safeLevel = Math.max(1, Math.min(config.levelCount, level ?? config.levelCount));
    const color = palette.colors[safeLevel - 1] ?? palette.colors[palette.colors.length - 1];

    return (
        <div
            className="flex h-5 w-11 items-center justify-center rounded-[3px] font-poppins text-[14px] font-medium"
            style={{backgroundColor: color, color: '#C52F18'}}
        >
            LV. {safeLevel}
        </div>
    );
}
