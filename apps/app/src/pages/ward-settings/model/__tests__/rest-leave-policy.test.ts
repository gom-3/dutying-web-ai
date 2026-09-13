import {describe, expect, it} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {
    calculateBaseRestTarget,
    calculateRestTargetFromDays,
    calculateRestTargetForLanguage,
    calculateRestTarget,
    countPublicHolidaysForLanguage,
    countPublicHolidaysForRestTarget,
    countWeeklyRestDaysInMonth,
    DEFAULT_REST_LEAVE_POLICY,
    getDefaultCountedRestShiftTypeIds,
    getHolidayCountryForLanguage,
    getPublicHolidayDaysForLanguage,
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

    it('지원 언어에 맞춰 공휴일 국가를 정한다', () => {
        expect(getHolidayCountryForLanguage('ko-KR')).toBe('KR');
        expect(getHolidayCountryForLanguage('ja-JP')).toBe('JP');
        expect(getHolidayCountryForLanguage('en-US')).toBe('US');
        expect(getHolidayCountryForLanguage('zh-CN')).toBe('CN');
        expect(getHolidayCountryForLanguage('th-TH')).toBe('TH');
        expect(getHolidayCountryForLanguage('vi-VN')).toBe('VN');
        expect(getHolidayCountryForLanguage('unsupported')).toBe('KR');
    });

    it('언어별 국가 공휴일을 여러 날인 연휴까지 날짜별로 계산한다', () => {
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'ko').map(({day}) => day)).toEqual([24, 25, 26]);
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'ja').map(({day}) => day)).toEqual([21, 22, 23]);
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'en').map(({day}) => day)).toEqual([7]);
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'zh').map(({day}) => day)).toEqual([25]);
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'th')).toEqual([]);
        expect(getPublicHolidayDaysForLanguage(2026, 9, 'vi').map(({day}) => day)).toEqual([2]);
    });

    it('언어별 공휴일 중 실제 주말과 겹치지 않는 날만 목표 휴무일에 더한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 2};

        expect(countPublicHolidaysForLanguage(2026, 9, 'ko')).toBe(2);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'ko')).toBe(10);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'ja')).toBe(11);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'en')).toBe(9);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'zh')).toBe(9);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'th')).toBe(8);
        expect(calculateRestTargetForLanguage(policy, 2026, 9, 'vi')).toBe(9);
        expect(calculateRestTargetForLanguage({...policy, includeHolidays: false}, 2026, 9, 'ja')).toBe(8);
    });

    it('알 수 없는 저장값은 단순 기본 정책으로 정규화한다', () => {
        expect(normalizeRestLeavePolicy({targetMode: 'manual', leaveCountMode: 'custom'})).toEqual(DEFAULT_REST_LEAVE_POLICY);
    });

    it('휴무일 계산 사용 여부를 저장값에서 정규화한다', () => {
        expect(normalizeRestLeavePolicy({enabled: false})).toMatchObject({enabled: false});
        expect(normalizeRestLeavePolicy({enabled: 'yes'})).toMatchObject({enabled: true});
    });
});
