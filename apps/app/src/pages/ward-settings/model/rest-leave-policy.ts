import Holidays from 'date-holidays';
import {useCallback, useEffect, useState} from 'react';
import type {TDay, TWardShiftType} from '@/entities';
import {DEFAULT_PREFERRED_LANGUAGE, normalizePreferredLanguage} from '@/shared/i18n/locale';

export type TRestTargetMode = 'weekly' | 'fixed';
export type TLeaveCountMode = 'allLeaves' | 'offOnly';
export type THolidayCountry = 'KR' | 'JP' | 'US' | 'CN' | 'TH' | 'VN';

export type TRestLeavePolicy = {
    enabled: boolean;
    targetMode: TRestTargetMode;
    weeklyOffDays: number;
    fixedMonthlyOffDays: number;
    includeHolidays: boolean;
    countedRestShiftTypeIds: number[] | null;
    leaveCountMode: TLeaveCountMode;
    carryOverEnabled: boolean;
};

export const REST_LEAVE_POLICY_UPDATED_EVENT = 'dutying:rest-leave-policy-updated';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLIDAY_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const MAX_CACHED_HOLIDAY_YEARS = 24;
const holidayCalendars = new Map<THolidayCountry, Holidays>();
const publicHolidaysByYearCache = new Map<string, ReturnType<Holidays['getHolidays']>>();
const publicHolidayDaysCache = new Map<string, TDay[]>();

export const DEFAULT_REST_LEAVE_POLICY: TRestLeavePolicy = {
    enabled: true,
    targetMode: 'weekly',
    weeklyOffDays: 2,
    fixedMonthlyOffDays: 6,
    includeHolidays: true,
    countedRestShiftTypeIds: null,
    leaveCountMode: 'allLeaves',
    carryOverEnabled: false,
};

type TRestLeavePolicyUpdatedEventDetail = {
    wardId: number;
    policy: TRestLeavePolicy;
};

function getStorageKey(wardId: number) {
    return `dutying:ward:${wardId}:rest-leave-policy`;
}

function clampDayCount(value: unknown, fallback: number, min = 0, max = 31) {
    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) return fallback;

    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeStringOption<T extends string>(value: unknown, fallback: T, options: readonly T[]): T {
    return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
}

function normalizeIdList(value: unknown) {
    if (!Array.isArray(value)) return null;

    return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
}

export function normalizeRestLeavePolicy(value: unknown): TRestLeavePolicy {
    const raw = value && typeof value === 'object' ? (value as Partial<TRestLeavePolicy>) : {};

    return {
        enabled: raw.enabled === undefined ? DEFAULT_REST_LEAVE_POLICY.enabled : Boolean(raw.enabled),
        targetMode: normalizeStringOption<TRestTargetMode>(raw.targetMode, DEFAULT_REST_LEAVE_POLICY.targetMode, ['weekly', 'fixed']),
        weeklyOffDays: clampDayCount(raw.weeklyOffDays, DEFAULT_REST_LEAVE_POLICY.weeklyOffDays, 1, 7),
        fixedMonthlyOffDays: clampDayCount(raw.fixedMonthlyOffDays, DEFAULT_REST_LEAVE_POLICY.fixedMonthlyOffDays),
        includeHolidays: raw.includeHolidays === undefined ? DEFAULT_REST_LEAVE_POLICY.includeHolidays : Boolean(raw.includeHolidays),
        countedRestShiftTypeIds: normalizeIdList(raw.countedRestShiftTypeIds),
        leaveCountMode: normalizeStringOption<TLeaveCountMode>(raw.leaveCountMode, DEFAULT_REST_LEAVE_POLICY.leaveCountMode, [
            'allLeaves',
            'offOnly',
        ]),
        carryOverEnabled: Boolean(raw.carryOverEnabled),
    };
}

export function loadRestLeavePolicy(wardId: number | null | undefined): TRestLeavePolicy {
    if (!wardId || typeof window === 'undefined') return DEFAULT_REST_LEAVE_POLICY;

    try {
        const raw = window.localStorage.getItem(getStorageKey(wardId));

        if (!raw) return DEFAULT_REST_LEAVE_POLICY;

        return normalizeRestLeavePolicy(JSON.parse(raw));
    } catch {
        return DEFAULT_REST_LEAVE_POLICY;
    }
}

export function saveRestLeavePolicy(wardId: number | null | undefined, policy: TRestLeavePolicy) {
    if (!wardId || typeof window === 'undefined') return;

    const normalized = normalizeRestLeavePolicy(policy);

    window.localStorage.setItem(getStorageKey(wardId), JSON.stringify(normalized));
    window.dispatchEvent(
        new CustomEvent<TRestLeavePolicyUpdatedEventDetail>(REST_LEAVE_POLICY_UPDATED_EVENT, {
            detail: {wardId, policy: normalized},
        }),
    );
}

export function useRestLeavePolicy(wardId: number | null | undefined) {
    const [policy, setPolicyState] = useState<TRestLeavePolicy>(() => loadRestLeavePolicy(wardId));

    useEffect(() => {
        setPolicyState(loadRestLeavePolicy(wardId));
    }, [wardId]);

    useEffect(() => {
        if (!wardId || typeof window === 'undefined') return;

        const handlePolicyUpdated = (event: Event) => {
            const detail = (event as CustomEvent<TRestLeavePolicyUpdatedEventDetail>).detail;

            if (detail?.wardId !== wardId) return;

            setPolicyState(detail.policy);
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== getStorageKey(wardId)) return;

            setPolicyState(loadRestLeavePolicy(wardId));
        };

        window.addEventListener(REST_LEAVE_POLICY_UPDATED_EVENT, handlePolicyUpdated);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener(REST_LEAVE_POLICY_UPDATED_EVENT, handlePolicyUpdated);
            window.removeEventListener('storage', handleStorage);
        };
    }, [wardId]);

    const setPolicy = useCallback(
        (nextPolicy: TRestLeavePolicy) => {
            const normalized = normalizeRestLeavePolicy(nextPolicy);

            setPolicyState(normalized);
            saveRestLeavePolicy(wardId, normalized);
        },
        [wardId],
    );

    return {policy, setPolicy};
}

export function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function isWeeklyRestDate(year: number, month: number, day: number, weeklyOffDays: number) {
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const mondayBasedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

    // 1일은 일요일, 2일은 토·일요일처럼 주말에서 거꾸로 주간 휴무일을 적용한다.
    return mondayBasedDayOfWeek > 7 - weeklyOffDays;
}

export function countWeeklyRestDaysInMonth(year: number, month: number, weeklyOffDays: number) {
    const normalizedWeeklyOffDays = clampDayCount(weeklyOffDays, DEFAULT_REST_LEAVE_POLICY.weeklyOffDays, 1, 7);
    const daysInMonth = getDaysInMonth(year, month);

    let count = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
        if (isWeeklyRestDate(year, month, day, normalizedWeeklyOffDays)) count += 1;
    }

    return count;
}

export function getHolidayCountryForLanguage(language?: string | null): THolidayCountry {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? DEFAULT_PREFERRED_LANGUAGE;

    return (
        {
            ko: 'KR',
            ja: 'JP',
            en: 'US',
            zh: 'CN',
            th: 'TH',
            vi: 'VN',
        } satisfies Record<NonNullable<ReturnType<typeof normalizePreferredLanguage>>, THolidayCountry>
    )[normalizedLanguage];
}

function getPublicHolidaysForYear(country: THolidayCountry, year: number, language: string) {
    const cacheKey = `${country}:${year}`;
    const cachedHolidays = publicHolidaysByYearCache.get(cacheKey);

    if (cachedHolidays) return cachedHolidays;

    let calendar = holidayCalendars.get(country);

    if (!calendar) {
        calendar = new Holidays(country, {languages: [language], types: ['public']});
        holidayCalendars.set(country, calendar);
    }

    const holidays = calendar.getHolidays(year);

    // Reuse the same year's calculations when moving between months, with a
    // bounded cache for sessions that browse many years.
    if (publicHolidaysByYearCache.size >= MAX_CACHED_HOLIDAY_YEARS) {
        publicHolidaysByYearCache.delete(publicHolidaysByYearCache.keys().next().value!);
    }

    publicHolidaysByYearCache.set(cacheKey, holidays);

    return holidays;
}

export function getPublicHolidayDaysForLanguage(year: number, month: number, language?: string | null): TDay[] {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? DEFAULT_PREFERRED_LANGUAGE;
    const country = getHolidayCountryForLanguage(normalizedLanguage);
    const cacheKey = `${country}:${year}:${month}`;
    const cachedDays = publicHolidayDaysCache.get(cacheKey);

    if (cachedDays) return cachedDays;

    const holidayDates = new Set<number>();
    const yearsToLoad = month === 1 ? [year - 1, year] : [year];

    yearsToLoad.forEach((holidayYear) => {
        getPublicHolidaysForYear(country, holidayYear, normalizedLanguage).forEach((holiday) => {
            if (holiday.type !== 'public') return;

            const dateParts = HOLIDAY_DATE_PATTERN.exec(holiday.date);

            if (!dateParts) return;

            const [, startYearText, startMonthText, startDayText] = dateParts;
            const startYear = Number(startYearText);
            const startMonth = Number(startMonthText);
            const startDay = Number(startDayText);
            const durationDays = Math.max(1, Math.round((holiday.end.getTime() - holiday.start.getTime()) / MILLISECONDS_PER_DAY));

            for (let offset = 0; offset < durationDays; offset += 1) {
                const date = new Date(Date.UTC(startYear, startMonth - 1, startDay + offset));

                if (date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month) {
                    holidayDates.add(date.getUTCDate());
                }
            }
        });
    });

    const days = [...holidayDates].sort((left, right) => left - right).map((day): TDay => ({day, dayType: 'holiday'}));

    if (publicHolidayDaysCache.size >= MAX_CACHED_HOLIDAY_YEARS * 12) {
        publicHolidayDaysCache.delete(publicHolidayDaysCache.keys().next().value!);
    }

    publicHolidayDaysCache.set(cacheKey, days);

    return days;
}

export function calculateBaseRestTarget(policy: TRestLeavePolicy, year: number, month: number) {
    if (!policy.enabled) return 0;

    if (policy.targetMode === 'fixed') return policy.fixedMonthlyOffDays;

    return countWeeklyRestDaysInMonth(year, month, policy.weeklyOffDays);
}

export function calculateRestTarget(policy: TRestLeavePolicy, year: number, month: number, holidayCount = 0) {
    if (!policy.enabled) return 0;

    return calculateBaseRestTarget(policy, year, month) + (policy.includeHolidays ? holidayCount : 0);
}

function normalizeDayType(dayType: TDay['dayType'] | string) {
    return String(dayType)
        .trim()
        .replace(/[\s_-]/g, '')
        .toLowerCase();
}

export function countPublicHolidaysForRestTarget(
    year: number,
    month: number,
    days: Array<TDay | {day: number; dayType: string}> = [],
    weeklyOffDays = DEFAULT_REST_LEAVE_POLICY.weeklyOffDays,
) {
    const normalizedWeeklyOffDays = clampDayCount(weeklyOffDays, DEFAULT_REST_LEAVE_POLICY.weeklyOffDays, 1, 7);

    return days.filter(
        (day) => normalizeDayType(day.dayType).includes('holiday') && !isWeeklyRestDate(year, month, day.day, normalizedWeeklyOffDays),
    ).length;
}

export function calculateRestTargetFromDays(policy: TRestLeavePolicy, year: number, month: number, days: TDay[] = []) {
    if (!policy.enabled || !policy.includeHolidays) return calculateBaseRestTarget(policy, year, month);

    const weeklyOffDays = policy.targetMode === 'weekly' ? policy.weeklyOffDays : DEFAULT_REST_LEAVE_POLICY.weeklyOffDays;

    return calculateRestTarget(policy, year, month, countPublicHolidaysForRestTarget(year, month, days, weeklyOffDays));
}

export function countPublicHolidaysForLanguage(
    year: number,
    month: number,
    language?: string | null,
    weeklyOffDays = DEFAULT_REST_LEAVE_POLICY.weeklyOffDays,
) {
    return countPublicHolidaysForRestTarget(year, month, getPublicHolidayDaysForLanguage(year, month, language), weeklyOffDays);
}

export function calculateRestTargetForLanguage(policy: TRestLeavePolicy, year: number, month: number, language?: string | null) {
    if (!policy.enabled || !policy.includeHolidays) return calculateBaseRestTarget(policy, year, month);

    return calculateRestTargetFromDays(policy, year, month, getPublicHolidayDaysForLanguage(year, month, language));
}

export function getRestShiftTypes(shiftTypes: TWardShiftType[]) {
    return shiftTypes.filter((shiftType) => shiftType.isOff);
}

export function getDefaultCountedRestShiftTypeIds(shiftTypes: TWardShiftType[]) {
    return getRestShiftTypes(shiftTypes).map((shiftType) => shiftType.wardShiftTypeId);
}

function resolveLegacyCountedRestShiftTypeIds(policy: TRestLeavePolicy, shiftTypes: TWardShiftType[]) {
    if (policy.leaveCountMode === 'allLeaves') return getDefaultCountedRestShiftTypeIds(shiftTypes);

    return getRestShiftTypes(shiftTypes)
        .filter((shiftType) => shiftType.classification === 'OFF')
        .map((shiftType) => shiftType.wardShiftTypeId);
}

export function resolveCountedRestShiftTypeIds(policy: TRestLeavePolicy, shiftTypes: TWardShiftType[]) {
    const restShiftTypes = getRestShiftTypes(shiftTypes);
    const restShiftTypeIds = new Set(restShiftTypes.map((shiftType) => shiftType.wardShiftTypeId));

    if (policy.countedRestShiftTypeIds !== null) {
        return policy.countedRestShiftTypeIds.filter((shiftTypeId) => restShiftTypeIds.has(shiftTypeId));
    }

    return resolveLegacyCountedRestShiftTypeIds(policy, shiftTypes);
}

export function getCountedRestShiftTypeNames(policy: TRestLeavePolicy, shiftTypes: TWardShiftType[]) {
    const selectedIds = new Set(resolveCountedRestShiftTypeIds(policy, shiftTypes));

    return getRestShiftTypes(shiftTypes)
        .filter((shiftType) => selectedIds.has(shiftType.wardShiftTypeId))
        .map((shiftType) => shiftType.name || shiftType.shortName);
}
