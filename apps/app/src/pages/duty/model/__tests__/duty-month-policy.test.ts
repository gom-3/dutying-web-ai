/** @vitest-environment node */
import {describe, expect, it} from 'vitest';
import {
    getCalendarYearMonthNow,
    getNextCalendarYearMonth,
    isDutyAtMaxFutureMonth,
    isDutyCalendarViewAllowed,
    isDutyPastStrictlyBeforeLastMonth,
    isDutyViewingThisCalendarMonth,
    isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth,
    isMakeShiftMonthAllowed,
    isMakeShiftPreviousMonthDisabled,
    monthsAfterTodayYearMonth,
} from '../duty-month-policy';

function addMonths({year, month}: {year: number; month: number}, offset: number): {year: number; month: number} {
    const monthIndex = year * 12 + (month - 1) + offset;

    return {
        year: Math.floor(monthIndex / 12),
        month: (monthIndex % 12) + 1,
    };
}

describe('dutyMonthPolicy', () => {
    it('monthsAfterTodayYearMonth is 0 for this calendar month', () => {
        const {year, month} = getCalendarYearMonthNow();

        expect(monthsAfterTodayYearMonth(year, month)).toBe(0);
    });

    it('getNextCalendarYearMonth returns the next calendar month', () => {
        const {year, month} = getNextCalendarYearMonth();

        expect(monthsAfterTodayYearMonth(year, month)).toBe(1);
    });

    it('allows this month, next month, and past months; blocks month after next', () => {
        const {year, month} = getCalendarYearMonthNow();

        expect(isDutyCalendarViewAllowed(year, month)).toBe(true);

        const lastM = month > 1 ? month - 1 : 12;
        const lastY = month > 1 ? year : year - 1;

        expect(isDutyCalendarViewAllowed(lastY, lastM)).toBe(true);

        const nextM = month >= 12 ? 1 : month + 1;
        const nextY = month >= 12 ? year + 1 : year;

        expect(isDutyCalendarViewAllowed(nextY, nextM)).toBe(true);

        const afterNextM = nextM >= 12 ? 1 : nextM + 1;
        const afterNextY = nextM >= 12 ? nextY + 1 : nextY;

        expect(isDutyCalendarViewAllowed(afterNextY, afterNextM)).toBe(false);
    });

    it('isDutyPastStrictlyBeforeLastMonth excludes last month and this month', () => {
        const {year, month} = getCalendarYearMonthNow();
        const lastM = month > 1 ? month - 1 : 12;
        const lastY = month > 1 ? year : year - 1;
        const twoAgoM = lastM > 1 ? lastM - 1 : 12;
        const twoAgoY = lastM > 1 ? lastY : lastY - 1;

        expect(isDutyPastStrictlyBeforeLastMonth(year, month)).toBe(false);
        expect(isDutyPastStrictlyBeforeLastMonth(lastY, lastM)).toBe(false);
        expect(isDutyPastStrictlyBeforeLastMonth(twoAgoY, twoAgoM)).toBe(true);
    });

    it('isMakeShiftMonthAllowed allows all past months through next month', () => {
        const current = getCalendarYearMonthNow();
        const last = addMonths(current, -1);
        const next = addMonths(current, 1);
        const twoMonthsLater = addMonths(current, 2);

        expect(isMakeShiftMonthAllowed(current.year, current.month)).toBe(true);
        expect(isMakeShiftMonthAllowed(last.year, last.month)).toBe(true);
        expect(isMakeShiftMonthAllowed(next.year, next.month)).toBe(true);
        expect(isMakeShiftMonthAllowed(twoMonthsLater.year, twoMonthsLater.month)).toBe(false);
    });

    it('make-shift month navigation allows previous months and stops at next month', () => {
        const current = getCalendarYearMonthNow();
        const next = addMonths(current, 1);

        expect(isMakeShiftPreviousMonthDisabled()).toBe(false);
        expect(isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth(current.year, current.month)).toBe(false);
        expect(isMakeShiftMonthAtOrAfterMaxFutureCalendarMonth(next.year, next.month)).toBe(true);
    });

    it('isDutyAtMaxFutureMonth is true on next month boundary', () => {
        const {year, month} = getCalendarYearMonthNow();
        const nextM = month >= 12 ? 1 : month + 1;
        const nextY = month >= 12 ? year + 1 : year;

        expect(isDutyAtMaxFutureMonth(year, month)).toBe(false);
        expect(isDutyAtMaxFutureMonth(nextY, nextM)).toBe(true);
    });

    it('isDutyViewingThisCalendarMonth matches this month only', () => {
        const {year, month} = getCalendarYearMonthNow();
        const nextM = month >= 12 ? 1 : month + 1;
        const nextY = month >= 12 ? year + 1 : year;

        expect(isDutyViewingThisCalendarMonth(year, month)).toBe(true);
        expect(isDutyViewingThisCalendarMonth(nextY, nextM)).toBe(false);
    });
});
