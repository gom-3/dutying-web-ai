/**
 * Shared calendar-month policy helpers for /duty and /make.
 */

export function getCalendarYearMonthNow(): {year: number; month: number} {
    const d = new Date();

    return {year: d.getFullYear(), month: d.getMonth() + 1};
}

/** Returns the calendar month immediately after the current month. */
export function getNextCalendarYearMonth(): {year: number; month: number} {
    const {year, month} = getCalendarYearMonthNow();

    return month >= 12 ? {year: year + 1, month: 1} : {year, month: month + 1};
}

/** Returns the month offset from the current calendar month. */
export function monthsAfterTodayYearMonth(year: number, month: number): number {
    const {year: y0, month: m0} = getCalendarYearMonthNow();

    return (year - y0) * 12 + (month - m0);
}

const MAKE_SHIFT_MAX_FUTURE_MONTH_OFFSET = 1;

/** /duty: view/query allowed through next month, including all past months. */
export function isDutyCalendarViewAllowed(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) <= 1;
}

/** /duty: disable the next-month arrow at the max future month. */
export function isDutyAtMaxFutureMonth(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) >= 1;
}

/** /duty: current calendar month, used to show the "create next month" action. */
export function isDutyViewingThisCalendarMonth(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) === 0;
}

/** /duty: strictly earlier than last month. */
export function isDutyPastStrictlyBeforeLastMonth(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) < -1;
}

/** /make: past months are unlimited; future months are allowed through next month. */
export function isMakeShiftMonthAllowed(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) <= MAKE_SHIFT_MAX_FUTURE_MONTH_OFFSET;
}

/** /make header: past navigation is unlimited. */
export function isMakeShiftPreviousMonthDisabled(): boolean {
    return false;
}

/** /make header: blocks moving beyond next month. */
export function isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth(year: number, month: number): boolean {
    return monthsAfterTodayYearMonth(year, month) >= MAKE_SHIFT_MAX_FUTURE_MONTH_OFFSET;
}
