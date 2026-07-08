import {cn} from '@dutying/utils/style';
import {Skeleton} from '@/shared/ui/primitives/skeleton';
import {
    REQUEST_CALENDAR_ANNUAL_LEAVE_COLUMN_CLASS,
    REQUEST_CALENDAR_NAME_COLUMN_CLASS,
    REQUEST_CALENDAR_ROW_GAP_CLASS,
} from './request-calendar/request-calendar-layout';

type TRequestCalendarSkeletonProps = {
    ariaLabel: string;
    className?: string;
    rowCount?: number;
    dayCount?: number;
};

const DEFAULT_ROW_COUNT = 8;
const DEFAULT_DAY_COUNT = 31;

export function RequestCalendarSkeleton({
    ariaLabel,
    className,
    rowCount = DEFAULT_ROW_COUNT,
    dayCount = DEFAULT_DAY_COUNT,
}: TRequestCalendarSkeletonProps) {
    const rows = Array.from({length: rowCount});
    const days = Array.from({length: dayCount});

    return (
        <div
            role="status"
            aria-busy="true"
            aria-label={ariaLabel}
            data-testid="request-calendar-skeleton"
            className={cn(
                'mx-auto mt-2 grid min-h-0 w-full max-w-none min-w-[1124px] flex-1 grid-cols-[minmax(840px,1fr)_minmax(271px,clamp(271px,18vw,344px))] items-start gap-3',
                className,
            )}
        >
            <section className="min-h-0 min-w-0 overflow-hidden rounded-[18px] bg-white p-2">
                <div className="flex min-h-[420px] w-full flex-col rounded-[18px] bg-white">
                    <div className="sticky top-0 z-20 mb-1 flex h-8 w-full items-center rounded-t-[18px] bg-white pt-1">
                        <div className={cn('flex w-full items-center', REQUEST_CALENDAR_ROW_GAP_CLASS)}>
                            <Skeleton className={cn('h-4 rounded-full bg-gray-6', REQUEST_CALENDAR_NAME_COLUMN_CLASS)} />
                            <Skeleton className={cn('h-4 rounded-full bg-gray-6', REQUEST_CALENDAR_ANNUAL_LEAVE_COLUMN_CLASS)} />
                            <div
                                className="grid min-w-0 flex-1 rounded-[12px] bg-gray-7 px-1 py-0.5"
                                style={{gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`}}
                            >
                                {days.map((_, index) => (
                                    <div key={index} className="grid min-w-0 place-items-center">
                                        <Skeleton className="h-5 w-3/5 rounded-full bg-gray-6/80" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-0 w-full flex-col gap-1 pb-1">
                        {rows.map((_, rowIndex) => (
                            <div key={rowIndex} className={cn('flex h-[44px] w-full items-stretch', REQUEST_CALENDAR_ROW_GAP_CLASS)}>
                                <div className={cn('flex items-center justify-center', REQUEST_CALENDAR_NAME_COLUMN_CLASS)}>
                                    <Skeleton className="h-4 w-9/12 rounded-full bg-gray-6" />
                                </div>
                                <div className={cn('flex items-center justify-center', REQUEST_CALENDAR_ANNUAL_LEAVE_COLUMN_CLASS)}>
                                    <Skeleton className="h-4 w-7/12 rounded-full bg-gray-6" />
                                </div>
                                <div className="grid min-w-0 flex-1" style={{gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`}}>
                                    {days.map((_, dayIndex) => (
                                        <div key={dayIndex} className="grid min-w-0 place-items-center">
                                            <Skeleton className="size-[24px] rounded-[6px] bg-gray-6/80" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <aside className="min-h-[420px] rounded-[18px] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-6 w-32 rounded-full bg-gray-6" />
                    <Skeleton className="h-8 w-20 rounded-[8px] bg-gray-6" />
                </div>
                <div className="mt-5 space-y-3">
                    {Array.from({length: 5}).map((_, index) => (
                        <div key={index} className="rounded-[12px] bg-gray-7 p-3">
                            <Skeleton className="h-4 w-8/12 rounded-full bg-gray-6" />
                            <Skeleton className="mt-2 h-3 w-5/12 rounded-full bg-gray-6/80" />
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}
