import {type TRequestShift} from '@/entities/shift';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {REQUEST_CALENDAR_HEADER_LABEL_TEXT_CLASS, REQUEST_CALENDAR_NAME_COLUMN_CLASS} from './request-calendar-layout';
import {getDayBadgeClass} from './utils';

interface IRequestCalendarHeaderProps {
    days: TRequestShift['days'];
    focusDay: number | undefined;
    separateWeekendColor: boolean;
}

export default function RequestCalendarHeader({days, focusDay, separateWeekendColor}: IRequestCalendarHeaderProps) {
    const {t} = useTypedTranslation();

    return (
        <div className="sticky top-0 z-20 mb-1 flex h-8 w-full items-center rounded-t-[18px] bg-white pt-1">
            <div className="flex w-full items-center gap-2">
                <div className={`${REQUEST_CALENDAR_NAME_COLUMN_CLASS} ${REQUEST_CALENDAR_HEADER_LABEL_TEXT_CLASS}`}>
                    {t('page.request.calendar.nameColumn')}
                </div>
                <div className="w-11 shrink-0 text-center font-apple text-[12px] font-semibold text-gray-4">
                    {t('page.request.calendar.skillColumn')}
                </div>
                <div className="w-6 shrink-0 text-center font-apple text-[12px] font-semibold text-gray-4">
                    {t('page.request.calendar.linkColumn')}
                </div>
                <div className="flex flex-1 rounded-[12px] bg-gray-7 px-1 py-0.5">
                    {days.map((day, index) => (
                        <p
                            key={day.day}
                            className={`min-w-0 flex-1 rounded-full text-center font-poppins text-[12px] leading-5 font-semibold ${getDayBadgeClass(
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
