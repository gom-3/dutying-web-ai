import {DutyManagementMonthTeamHeader} from '@/widgets/duty-management/ui';
import {useMakeShiftStore} from '../model/make-shift-store';

export function MakeShiftHeader() {
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const goPrevMonth = useMakeShiftStore((s) => s.goPrevMonth);
    const goNextMonth = useMakeShiftStore((s) => s.goNextMonth);
    const setCurrentShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);

    return (
        <DutyManagementMonthTeamHeader
            year={year}
            month={month}
            prevLabel="이전 달"
            nextLabel="다음 달"
            shiftTeams={shiftTeams}
            currentShiftTeamId={currentShiftTeamId}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onSelectShiftTeam={setCurrentShiftTeamId}
        />
    );
}
