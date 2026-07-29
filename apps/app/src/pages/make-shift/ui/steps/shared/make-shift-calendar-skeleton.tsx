import {cn} from '@dutying/utils/style';
import {Skeleton} from '@/shared/ui/primitives/skeleton';

type TMakeShiftCalendarSkeletonProps = {
    className?: string;
    rowCount?: number;
    dayCount?: number;
    showSummary?: boolean;
    showFooter?: boolean;
    ariaLabel?: string;
};

const DEFAULT_DAY_COUNT = 31;
const DEFAULT_ROW_COUNT = 9;
const SUMMARY_CELL_COUNT = 5;
const NAME_COL = 'clamp(84px,5.4cqw,96px)';
const LAST_COL = 'clamp(58px,4.05cqw,76px)';
const ROW_GAP_X = 'clamp(1px,0.18cqw,4px)';
const DIVISION_TO_SUMMARY_GAP = 'clamp(8px,0.65cqw,14px)';
const DIVISION_PADDING_X = 'clamp(2px,0.2cqw,4px)';
const SUMMARY_PADDING_X = 'clamp(0px,0.1cqw,2px)';
const SUMMARY_GAP = 'clamp(2px,0.22cqw,6px)';
const LEFT_GRID_TEMPLATE_COLUMNS = `${NAME_COL} ${LAST_COL} minmax(0,1fr)`;
const ROW_HEIGHT_CLASS = 'h-[clamp(32px,2.7cqw,44px)]';
const SUMMARY_CELL_CLASS = 'h-[clamp(16px,1.4cqw,22px)] w-[clamp(14px,1.05cqw,18px)]';
const ROW_SUMMARY_HEIGHT_CLASS = 'h-[clamp(28px,2.4cqw,40px)]';
const DAYS_GRID_STYLE = (dayCount: number) => ({gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))`});

export function MakeShiftCalendarSkeleton({
    className,
    rowCount = DEFAULT_ROW_COUNT,
    dayCount = DEFAULT_DAY_COUNT,
    showSummary = true,
    showFooter = true,
    ariaLabel = 'calendar loading',
}: TMakeShiftCalendarSkeletonProps) {
    const days = Array.from({length: dayCount});
    const rows = Array.from({length: rowCount});
    const summaryCells = Array.from({length: SUMMARY_CELL_COUNT});

    return (
        <div
            role="status"
            aria-busy="true"
            aria-label={ariaLabel}
            data-testid="make-shift-calendar-skeleton"
            className={cn('make-shift-calendar @container relative isolate flex w-full min-w-0 flex-col gap-2', className)}
        >
            <div
                className="make-shift-calendar__header flex w-full min-w-0 items-center py-1"
                style={{gap: showSummary ? DIVISION_TO_SUMMARY_GAP : 0}}
            >
                <div
                    className="make-shift-calendar__header-left grid min-w-0 flex-1 items-center"
                    style={{
                        gridTemplateColumns: LEFT_GRID_TEMPLATE_COLUMNS,
                        columnGap: ROW_GAP_X,
                        paddingLeft: DIVISION_PADDING_X,
                        paddingRight: 0,
                    }}
                >
                    <Skeleton className="mx-auto h-3 w-9 rounded-full bg-gray-6" />
                    <Skeleton className="mx-auto h-3 w-12 rounded-full bg-gray-6" />
                    <div
                        className="make-shift-calendar__day-header-pill grid min-w-0 rounded-[12px] bg-gray-7 px-0 py-1"
                        style={DAYS_GRID_STYLE(dayCount)}
                    >
                        {days.map((_, index) => (
                            <div key={index} className="grid min-w-0 place-items-center">
                                <Skeleton className="h-5 w-3/5 rounded-full bg-gray-6/80" />
                            </div>
                        ))}
                    </div>
                </div>

                {showSummary ? (
                    <div
                        className="make-shift-calendar__type-summary-header flex shrink-0 items-center"
                        style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
                    >
                        {summaryCells.map((_, index) => (
                            <Skeleton key={index} className={cn(SUMMARY_CELL_CLASS, 'rounded-[5px] bg-gray-6')} />
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="make-shift-calendar__body flex w-full min-w-0 flex-col gap-2">
                <div
                    className="make-shift-calendar__division flex w-full min-w-0 items-stretch"
                    style={{gap: showSummary ? DIVISION_TO_SUMMARY_GAP : 0}}
                >
                    <div className="make-shift-calendar__division-card relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[16px] bg-white">
                        {rows.map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className={cn(
                                    'make-shift-calendar__row make-shift-calendar__row-left grid w-full min-w-0 items-stretch',
                                    ROW_HEIGHT_CLASS,
                                )}
                                style={{
                                    gridTemplateColumns: LEFT_GRID_TEMPLATE_COLUMNS,
                                    columnGap: ROW_GAP_X,
                                    paddingLeft: DIVISION_PADDING_X,
                                    paddingRight: 0,
                                }}
                            >
                                <div className="make-shift-calendar__row-name flex min-h-0 min-w-0 items-center justify-center">
                                    <Skeleton className="h-4 w-8/12 rounded-full bg-gray-6" />
                                </div>
                                <div className="make-shift-calendar__row-last-shifts flex min-h-0 min-w-0 items-center justify-center gap-0.5 overflow-hidden">
                                    {Array.from({length: 4}).map((__, badgeIndex) => (
                                        <Skeleton
                                            key={badgeIndex}
                                            className="size-[clamp(13px,0.95cqw,17px)] shrink-0 rounded-[5px] bg-main-4/80"
                                        />
                                    ))}
                                </div>
                                <div
                                    className="make-shift-calendar__row-days grid h-full min-w-0 items-stretch px-0"
                                    style={DAYS_GRID_STYLE(dayCount)}
                                >
                                    {days.map((_, dayIndex) => (
                                        <div
                                            key={dayIndex}
                                            className="make-shift-calendar__day-cell flex min-w-0 items-center justify-center"
                                        >
                                            <Skeleton className="size-[clamp(16px,1.45vw,26px)] rounded-[6px] bg-gray-6/80" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {showSummary ? (
                        <div className="make-shift-calendar__division-summary flex shrink-0 flex-col">
                            {rows.map((_, rowIndex) => (
                                <div
                                    key={rowIndex}
                                    className={cn('make-shift-calendar__row-summary flex shrink-0 items-center', ROW_SUMMARY_HEIGHT_CLASS)}
                                    style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
                                >
                                    {summaryCells.map((__, cellIndex) => (
                                        <Skeleton key={cellIndex} className={cn(SUMMARY_CELL_CLASS, 'rounded-[5px] bg-gray-6/80')} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {showFooter ? (
                <div
                    className="make-shift-daily-summary flex w-full min-w-0 items-start"
                    style={{gap: showSummary ? DIVISION_TO_SUMMARY_GAP : 0}}
                >
                    <div
                        className="make-shift-daily-summary__left min-w-0 flex-1 rounded-[16px] bg-white py-1"
                        style={{paddingLeft: DIVISION_PADDING_X, paddingRight: 0}}
                    >
                        {summaryCells.slice(0, 3).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="make-shift-daily-summary__row grid h-[clamp(16px,1.4cqw,22px)] w-full min-w-0 items-center"
                                style={{gridTemplateColumns: `${NAME_COL} minmax(0,1fr)`, columnGap: ROW_GAP_X}}
                            >
                                <div className="flex items-center justify-center">
                                    <Skeleton className="size-[clamp(16px,1.4cqw,22px)] rounded-[5px] bg-main-4/80" />
                                </div>
                                <div className="grid min-w-0" style={DAYS_GRID_STYLE(dayCount)}>
                                    {days.map((_, dayIndex) => (
                                        <div key={dayIndex} className="grid min-w-0 place-items-center">
                                            <Skeleton className="h-3 w-3/5 rounded-full bg-gray-6/80" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    {showSummary ? (
                        <div
                            className="make-shift-daily-summary__spacer flex shrink-0 items-start pt-1"
                            style={{gap: SUMMARY_GAP, paddingInline: SUMMARY_PADDING_X}}
                        >
                            {summaryCells.map((_, index) => (
                                <Skeleton key={index} className={cn(SUMMARY_CELL_CLASS, 'rounded-[5px] bg-gray-6/80')} />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
