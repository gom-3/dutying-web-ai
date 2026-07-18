import {describe, expect, it} from 'vitest';
import type {TWardShiftType} from '@/entities';
import {
    calculateBaseRestTarget,
    calculateRestTarget,
    DEFAULT_REST_LEAVE_POLICY,
    getDefaultCountedRestShiftTypeIds,
    getHolidayCountryForLanguage,
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
    it('주 단위 기준으로 월 목표 휴무일을 계산한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'weekly' as const, weeklyOffDays: 2};

        expect(calculateBaseRestTarget(policy, 2026, 6)).toBe(10);
        expect(calculateRestTarget(policy, 2026, 6, 1)).toBe(11);
    });

    it('월 고정 기준은 공휴일 포함 여부와 분리해 계산한다', () => {
        const policy = {...DEFAULT_REST_LEAVE_POLICY, targetMode: 'fixed' as const, fixedMonthlyOffDays: 6};

        expect(calculateBaseRestTarget(policy, 2026, 6)).toBe(6);
        expect(calculateRestTarget(policy, 2026, 6, 2)).toBe(8);
        expect(calculateRestTarget({...policy, includeHolidays: false}, 2026, 6, 2)).toBe(6);
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
    });

    it('알 수 없는 저장값은 단순 기본 정책으로 정규화한다', () => {
        expect(normalizeRestLeavePolicy({targetMode: 'manual', leaveCountMode: 'custom'})).toEqual(DEFAULT_REST_LEAVE_POLICY);
    });

    it('휴무일 계산 사용 여부를 저장값에서 정규화한다', () => {
        expect(normalizeRestLeavePolicy({enabled: false})).toMatchObject({enabled: false});
        expect(normalizeRestLeavePolicy({enabled: 'yes'})).toMatchObject({enabled: true});
    });
});
