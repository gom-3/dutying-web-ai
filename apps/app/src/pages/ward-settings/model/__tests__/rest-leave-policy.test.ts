import Holidays from 'date-holidays';
import {describe, expect, it, vi} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {
    calculateBaseRestTarget,
    calculateRestTargetFromDays,
    calculateRestTargetForPolicy,
    calculateRestTarget,
    countPublicHolidaysForRestTarget,
    countWeeklyRestDaysInMonth,
    DEFAULT_REST_LEAVE_POLICY,
    getDefaultCountedRestShiftTypeIds,
    getPublicHolidayDaysForPolicy,
    normalizeRestLeavePolicy,
    resolveCountedRestShiftTypeIds,
} from '../rest-leave-policy';

const shiftTypes: TWardShiftType[] = [
    {
        wardShiftTypeId: 1,
        name: '오프',
        shortName: 'O',
        startTime: '',
        endTime: '',
        color: '#465B7A',
        isDefault: true,
        isOff: true,
        isCounted: false,
        classification: 'OFF',
    },
    {
        wardShiftTypeId: 2,
        name: '휴가',
        shortName: 'A',
        startTime: '',
        endTime: '',
        color: '#7C8AF2',
        isDefault: false,
        isOff: true,
        isCounted: false,
        classification: 'OTHER_LEAVE',
    },
    {
        wardShiftTypeId: 3,
        name: '데이',
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#63C8B8',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'DAY',
    },
];

describe('rest leave policy', () => {
    it('reuses annual holiday calculations across months and retains previous-year holidays in January', () => {
        const getHolidays = vi.spyOn(Holidays.prototype, 'getHolidays');

        try {
            for (let month = 1; month <= 12; month += 1) {
                getPublicHolidayDaysForPolicy(2032, month, {holidayCountry: 'KR', holidayRegion: null});
            }

            expect(getHolidays.mock.calls.map(([year]) => year)).toEqual([2031, 2032]);
            expect(getPublicHolidayDaysForPolicy(2032, 1, {holidayCountry: 'KR', holidayRegion: null}).map(({day}) => day)).toContain(1);
            expect(getHolidays).toHaveBeenCalledTimes(2);
        } finally {
            getHolidays.mockRestore();
        }
    });

    it('skips holiday calculation when it cannot affect the rest target', () => {
        const getHolidays = vi.spyOn(Holidays.prototype, 'getHolidays');

        try {
            expect(calculateRestTargetForPolicy({...DEFAULT_REST_LEAVE_POLICY, enabled: false}, 2040, 1)).toBe(0);
            expect(calculateRestTargetForPolicy({...DEFAULT_REST_LEAVE_POLICY, includeHolidays: false}, 2040, 1)).toBe(
                countWeeklyRestDaysInMonth(2040, 1, 2),
            );
            expect(getHolidays).not.toHaveBeenCalled();
        } finally {
            getHolidays.mockRestore();
        }
    });

    it('주 단위 기준을 실제 달력에 적용해 월 목표 휴무일을 계산한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 2};

        expect(countWeeklyRestDaysInMonth(2026, 6, 2)).toBe(8);
        expect(calculateBaseRestTarget(policy, 2026, 6)).toBe(8);
        expect(calculateRestTarget(policy, 2026, 6, 1)).toBe(9);
    });

    it('같은 5주 상당의 달이어도 실제 주말 개수를 따로 센다', () => {
        expect(countWeeklyRestDaysInMonth(2026, 6, 2)).toBe(8);
        expect(countWeeklyRestDaysInMonth(2026, 8, 2)).toBe(10);
    });

    it('주간 휴무일 수가 다르면 일요일부터 거꾸로 실제 날짜를 센다', () => {
        expect(countWeeklyRestDaysInMonth(2026, 8, 1)).toBe(5);
        expect(countWeeklyRestDaysInMonth(2026, 8, 3)).toBe(14);
    });

    it('월 고정 기준은 공휴일 포함 여부와 분리해 계산한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'fixed' as const, fixedMonthlyOffDays: 6};

        expect(calculateBaseRestTarget(policy, 2026, 6)).toBe(6);
        expect(calculateRestTarget(policy, 2026, 6, 2)).toBe(8);
        expect(calculateRestTarget({...policy, includeHolidays: false}, 2026, 6, 2)).toBe(6);
    });

    it('목표 휴무일에 평일 공휴일만 추가한다', () => {
        const days = [
            {day: 15, dayType: 'holiday' as const},
            {day: 17, dayType: 'holiday' as const},
        ];
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 2};

        expect(countPublicHolidaysForRestTarget(2026, 8, days)).toBe(1);
        expect(calculateRestTargetFromDays(policy, 2026, 8, days)).toBe(11);
    });

    it('이미 주간 휴무일에 포함된 공휴일은 중복해서 더하지 않는다', () => {
        const days = [
            {day: 14, dayType: 'holiday' as const},
            {day: 20, dayType: 'holiday' as const},
        ];
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 3};

        expect(countPublicHolidaysForRestTarget(2026, 8, days, policy.weeklyOffDays)).toBe(1);
        expect(calculateRestTargetFromDays(policy, 2026, 8, days)).toBe(15);
    });

    it('휴무일 계산을 끄면 기준일을 계산하지 않는다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, enabled: false};

        expect(calculateBaseRestTarget(policy, 2026, 6)).toBe(0);
        expect(calculateRestTarget(policy, 2026, 6, 2)).toBe(0);
    });

    it('기본값은 휴무 계열 근무유형을 모두 휴무일로 계산한다', () => {
        expect(getDefaultCountedRestShiftTypeIds(shiftTypes)).toEqual([1, 2]);
        expect(resolveCountedRestShiftTypeIds(DEFAULT_REST_LEAVE_POLICY, shiftTypes)).toEqual([1, 2]);
    });

    it('선택한 근무유형만 휴무일로 계산한다', () => {
        expect(resolveCountedRestShiftTypeIds({...DEFAULT_REST_LEAVE_POLICY, countedRestShiftTypeIds: [2, 3]}, shiftTypes)).toEqual([2]);
    });

    it('예전 OFF만 세는 저장값은 OFF 분류만 선택한다', () => {
        expect(resolveCountedRestShiftTypeIds({...DEFAULT_REST_LEAVE_POLICY, leaveCountMode: 'offOnly'}, shiftTypes)).toEqual([1]);
    });

    it('선택한 국가 공휴일을 여러 날인 연휴까지 날짜별로 계산한다', () => {
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'KR', holidayRegion: null}).map(({day}) => day)).toEqual([
            24, 25, 26,
        ]);
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'JP', holidayRegion: null}).map(({day}) => day)).toEqual([
            21, 22, 23,
        ]);
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'US', holidayRegion: null}).map(({day}) => day)).toEqual([7]);
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'CN', holidayRegion: null}).map(({day}) => day)).toEqual([25]);
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'TH', holidayRegion: null})).toEqual([]);
        expect(getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'VN', holidayRegion: null}).map(({day}) => day)).toEqual([2]);
    });

    it('국가별 공휴일 중 실제 주말과 겹치지 않는 날만 목표 휴무일에 더한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 2};

        expect(
            countPublicHolidaysForRestTarget(2026, 9, getPublicHolidayDaysForPolicy(2026, 9, {holidayCountry: 'KR', holidayRegion: null})),
        ).toBe(2);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'KR'}, 2026, 9)).toBe(10);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'JP'}, 2026, 9)).toBe(11);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'US'}, 2026, 9)).toBe(9);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'CN'}, 2026, 9)).toBe(9);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'TH'}, 2026, 9)).toBe(8);
        expect(calculateRestTargetForPolicy({...policy, holidayCountry: 'VN'}, 2026, 9)).toBe(9);
        expect(calculateRestTargetForPolicy({...policy, includeHolidays: false}, 2026, 9)).toBe(8);
    });

    it('알 수 없는 저장값은 단순 기본 정책으로 정규화한다', () => {
        expect(normalizeRestLeavePolicy({targetMode: 'manual', leaveCountMode: 'custom'})).toEqual(DEFAULT_REST_LEAVE_POLICY);
    });

    it('휴무일 계산 사용 여부를 저장값에서 정규화한다', () => {
        expect(normalizeRestLeavePolicy({enabled: false})).toMatchObject({enabled: false});
        expect(normalizeRestLeavePolicy({enabled: 'yes'})).toMatchObject({enabled: true});
    });
});

describe('explicit holiday locations', () => {
    it('distinguishes UK regions and keeps their caches separate', () => {
        const england = {holidayCountry: 'GB' as const, holidayRegion: 'ENG'};
        const scotland = {...england, holidayRegion: 'SCT'};

        expect(getPublicHolidayDaysForPolicy(2026, 1, england).map((d) => d.day)).toEqual([1]);
        expect(getPublicHolidayDaysForPolicy(2026, 1, scotland).map((d) => d.day)).toEqual([1, 2]);
        expect(getPublicHolidayDaysForPolicy(2026, 1, england).map((d) => d.day)).toEqual([1]);
    });
    it('supports Ireland and European regional holidays', () => {
        expect(getPublicHolidayDaysForPolicy(2026, 3, {holidayCountry: 'IE', holidayRegion: null}).map((d) => d.day)).toContain(17);
        expect(getPublicHolidayDaysForPolicy(2026, 1, {holidayCountry: 'DE', holidayRegion: 'BW'}).map((d) => d.day)).toContain(6);
        expect(getPublicHolidayDaysForPolicy(2026, 1, {holidayCountry: 'DE', holidayRegion: 'BE'}).map((d) => d.day)).not.toContain(6);
    });
    it('does not infer a country when the ward has not selected one', () => {
        expect(getPublicHolidayDaysForPolicy(2026, 9, DEFAULT_REST_LEAVE_POLICY)).toEqual([]);
        expect(getPublicHolidayDaysForPolicy(2026, 1, {holidayCountry: 'GB', holidayRegion: null})).toEqual([]);
        expect(normalizeRestLeavePolicy({holidayCountry: 'KR', holidayRegion: 'SCT'}).holidayRegion).toBeNull();
        expect(normalizeRestLeavePolicy({holidayCountry: 'XX'}).holidayCountry).toBeNull();
    });
});
