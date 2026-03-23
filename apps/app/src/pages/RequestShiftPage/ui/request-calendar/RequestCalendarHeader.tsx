import {type TRequestShift} from '@/entities/shift';
import {getDayBadgeClass} from './utils';

interface IRequestCalendarHeaderProps {
    days: TRequestShift['days'];
    focusDay: number | undefined;
    separateWeekendColor: boolean;
}

export default function RequestCalendarHeader({days, focusDay, separateWeekendColor}: IRequestCalendarHeaderProps) {
    return (
        <div className="z-20 mb-3 flex h-7.5 min-w-max items-center gap-5 bg-white pt-2 pr-4">
            <div className="flex gap-5">
                <div className="w-13.5 text-center font-apple text-[1rem] font-medium text-gray-4">{/* 구분 */}</div>
                <div className="w-17.5 text-center font-apple text-[1rem] font-medium text-gray-4">이름</div>
                <div className="w-7.5 text-center font-apple text-[1rem] font-medium text-gray-4">연동</div>
                <div className="flex rounded-[2.5rem] border border-sub-4.5 px-4 py-[.1875rem]">
                    {days.map((day, index) => (
                        <p
                            key={day.day}
                            className={`w-9 flex-1 rounded-full text-center font-poppins text-[1rem] ${getDayBadgeClass(
                                day.dayType,
                                index === focusDay,
                                separateWeekendColor,
                            )}`}
                        >
                            {day.day}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
}
