import SkillBadgeUi from '@/features/ward-skill/ui/skill-badge';
import {type TOnboardingWardShiftType, type TSkillLevelConfig} from '../../model';

const SHIFT_BADGE_TEXT_STYLE = 'font-poppins text-[14px] font-medium text-white';

export function ShiftBadge({shiftType}: {shiftType: TOnboardingWardShiftType}) {
    return (
        <div className="flex h-[23px] w-[21px] items-center justify-center rounded-[5px]" style={{backgroundColor: shiftType.color}}>
            <span className={SHIFT_BADGE_TEXT_STYLE}>{shiftType.shortName || '-'}</span>
        </div>
    );
}

export function SkillBadge({level, config}: {level: number | null; config: TSkillLevelConfig}) {
    return <SkillBadgeUi level={level} config={config} />;
}
