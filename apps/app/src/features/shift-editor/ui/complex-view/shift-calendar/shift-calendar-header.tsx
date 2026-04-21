import {type TWardShiftType, type TShift} from '@/entities';

type TShiftCalendarHeaderProps = {
    shift: TShift;
    effectiveFocusDay?: number;
    separateWeekendColor: boolean;
    shiftTypeColorStyle: string;
};

export function ShiftCalendarHeader({shift, effectiveFocusDay, separateWeekendColor, shiftTypeColorStyle}: TShiftCalendarHeaderProps) {
    const offShiftType = shift.wardShiftTypes.find((x) => x.name === '오프');

    return (
        <div className="z-20 flex items-center gap-5 py-[.75rem] pr-4">
            <div className="flex h-7.5 gap-5">
                <div className="w-5 text-center font-apple text-[1rem] font-medium text-sub-3">{/* 구분 */}</div>
                <div className="w-17.5 text-center font-apple text-[1rem] font-medium text-sub-3">이름</div>
                <div className="w-7.5 text-center font-apple text-[1rem] font-medium text-sub-3">이월</div>
                <div className="w-22.5 text-center font-apple text-[1rem] font-medium text-sub-3">전달 근무</div>
                <div className="flex rounded-[2.5rem] border-[.0625rem] border-sub-4 px-4 py-[.1875rem]">
                    {shift.days.map((item, j) => (
                        <p
                            key={j}
                            className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${
                                item.dayType === 'saturday'
                                    ? j === effectiveFocusDay
                                        ? separateWeekendColor
                                            ? 'bg-blue text-white'
                                            : 'bg-red text-white'
                                        : separateWeekendColor
                                          ? 'text-blue'
                                          : 'text-red'
                                    : item.dayType === 'sunday' || item.dayType === 'holiday'
                                      ? j === effectiveFocusDay
                                          ? 'bg-red text-white'
                                          : 'text-red'
                                      : item.dayType === 'workday'
                                        ? j === effectiveFocusDay
                                            ? 'bg-main-1 text-white'
                                            : 'text-sub-2.5'
                                        : ''
                            } `}
                        >
                            {item.day}
                        </p>
                    ))}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 px-6.25 text-center">
                {shift.wardShiftTypes
                    .filter((x) => x.isCounted)
                    .map((shiftType: TWardShiftType) => (
                        <div
                            key={shiftType.wardShiftTypeId}
                            className="flex h-6 w-6 items-center justify-center rounded-[.375rem] p-2 font-poppins text-[1.25rem]"
                            style={
                                shiftTypeColorStyle === 'background'
                                    ? {backgroundColor: shiftType.color, color: 'white'}
                                    : {color: shiftType.color, backgroundColor: 'white'}
                            }
                        >
                            {shiftType.shortName}
                        </div>
                    ))}
                <div
                    className="flex h-6 w-6 items-center justify-center rounded-[.375rem] bg-red p-2 font-poppins text-[0.8rem] text-white"
                    style={
                        shiftTypeColorStyle === 'background'
                            ? {backgroundColor: offShiftType?.color, color: 'white'}
                            : {color: offShiftType?.color, backgroundColor: 'white'}
                    }
                >
                    WO
                </div>
            </div>
        </div>
    );
}
