import {ChevronLeftIcon, ChevronRightIcon} from '@/shared/assets/svg';
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
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="grid size-6 place-items-center text-gray-5 hover:text-gray-4"
                        onClick={goPrevMonth}
                        aria-label="이전 달"
                    >
                        <ChevronLeftIcon />
                    </button>
                    <div className="font-apple text-2xl font-semibold text-main-1">
                        {year}년 {month}월
                    </div>
                    <button
                        type="button"
                        className="grid size-6 place-items-center text-gray-5 hover:text-gray-4"
                        onClick={goNextMonth}
                        aria-label="다음 달"
                    >
                        <ChevronRightIcon />
                    </button>
                </div>

                <div className="max-w-full rounded-[10px] bg-main-light px-[10px] py-[7px]">
                    <div className="scrollbar-hide flex max-w-full gap-1 overflow-x-auto whitespace-nowrap">
                        {shiftTeams.map((team) => {
                            const selected = team.shiftTeamId === currentShiftTeamId;

                            return (
                                <button
                                    key={team.shiftTeamId}
                                    type="button"
                                    onClick={() => setCurrentShiftTeamId(team.shiftTeamId)}
                                    className={`flex items-center justify-center rounded-[10px] px-[16px] py-[6px] ${
                                        selected ? 'bg-main-1 text-white' : 'text-gray-3'
                                    }`}
                                >
                                    <p className="h-[20px] font-apple text-base leading-normal font-medium">{team.name}</p>
                                </button>
                            );
                        })}

                        {shiftTeams.length === 0 && (
                            <div className="px-4 py-1.5 font-apple text-base font-medium text-gray-3">근무팀 없음</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
