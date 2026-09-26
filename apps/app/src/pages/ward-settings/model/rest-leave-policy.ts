import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Holidays from 'date-holidays';
import {useMemo} from 'react';
import type {TDay, TWardShiftType} from '@/entities';
import axiosInstance from '@/shared/api/client';
import {HOLIDAY_COUNTRIES, getHolidayRegions, type THolidayCountry} from './holiday-location';
export type {THolidayCountry} from './holiday-location';

export type TRestTargetMode = 'weekly' | 'fixed';
export type TLeaveCountMode = 'allLeaves' | 'offOnly';

export type TRestLeavePolicy = {
    enabled: boolean;
    targetMode: TRestTargetMode;
    weeklyOffDays: number;
    fixedMonthlyOffDays: number;
    includeHolidays: boolean;
    countedRestShiftTypeIds: number[] | null;
    leaveCountMode: TLeaveCountMode;
    carryOverEnabled: boolean;
    holidayCountry: THolidayCountry | null;
    holidayRegion: string | null;
};

export type TRestLeavePolicyResponse = TRestLeavePolicy & {wardId: number; persisted: boolean; version: number};
export const restLeavePolicyQueryKey = (wardId: number | null | undefined) => ['ward', 'restLeavePolicy', wardId];

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const HOLIDAY_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const MAX_CACHED_HOLIDAY_YEARS = 24;
const holidayCalendars = new Map<string, Holidays>();
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
    holidayCountry: null,
    holidayRegion: null,
};

const UNAVAILABLE_POLICY: TRestLeavePolicy = {...DEFAULT_REST_LEAVE_POLICY, enabled: false};

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
    const holidayCountry = HOLIDAY_COUNTRIES.includes(raw.holidayCountry as THolidayCountry)
        ? (raw.holidayCountry as THolidayCountry)
        : null;
    const holidayRegion =
        holidayCountry && raw.holidayRegion && getHolidayRegions(holidayCountry)[raw.holidayRegion] ? raw.holidayRegion : null;

    return {
        holidayCountry,
        holidayRegion,
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

// Only exposed as a user-initiated import when no shared policy exists. Never write back locally.
export function loadLegacyRestLeavePolicy(wardId: number | null | undefined): TRestLeavePolicy | null {
    if (!wardId || typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(getStorageKey(wardId));

        return raw ? normalizeRestLeavePolicy(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

export function useRestLeavePolicy(wardId: number | null | undefined) {
    const queryClient = useQueryClient();
    const queryKey = restLeavePolicyQueryKey(wardId);
    const query = useQuery({
        queryKey,
        enabled: Boolean(wardId),
        queryFn: async ({signal}) =>
            (
                await axiosInstance.get<TRestLeavePolicyResponse>(`/wards/${wardId}/rest-leave-policy`, {
                    suppressErrorToast: true,
                    signal,
                })
            ).data,
        staleTime: 0,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        retry: false,
    });
    const mutation = useMutation({
        mutationFn: async ({
            policy,
            version,
            targetWardId,
        }: {
            policy: TRestLeavePolicy;
            version: number;
            targetWardId: number | null | undefined;
        }) => {
            if (!targetWardId) throw new Error('Ward is required');

            return (
                await axiosInstance.put<TRestLeavePolicyResponse>(
                    `/wards/${targetWardId}/rest-leave-policy`,
                    {
                        ...policy,
                        version,
                    },
                    {suppressErrorToast: true},
                )
            ).data;
        },
        onSuccess: async (data) => {
            // Cancel older in-flight GETs before publishing the acknowledged server version.
            const savedQueryKey = restLeavePolicyQueryKey(data.wardId);

            await queryClient.cancelQueries({queryKey: savedQueryKey});
            queryClient.setQueryData(savedQueryKey, data);
        },
    });
    const policy = useMemo(
        () => (!query.isError && query.data ? normalizeRestLeavePolicy(query.data) : UNAVAILABLE_POLICY),
        [query.data, query.isError],
    );

    return {
        policy,
        version: query.data?.version ?? 0,
        persisted: query.data?.persisted ?? false,
        isLoading: Boolean(wardId) && query.isPending,
        isError: query.isError,
        isSaving: mutation.isPending,
        refetch: query.refetch,
        setPolicy: (nextPolicy: TRestLeavePolicy, version: number) =>
            mutation.mutateAsync({policy: nextPolicy, version, targetWardId: wardId}),
    };
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

function getPublicHolidaysForYear(country: THolidayCountry, region: string | null, year: number) {
    const locationKey = `${country}:${region ?? 'national'}`;
    const cacheKey = `${locationKey}:${year}`;
    const cachedHolidays = publicHolidaysByYearCache.get(cacheKey);

    if (cachedHolidays) return cachedHolidays;

    let calendar = holidayCalendars.get(locationKey);

    if (!calendar) {
        calendar = region ? new Holidays(country, region, {types: ['public']}) : new Holidays(country, {types: ['public']});
        holidayCalendars.set(locationKey, calendar);
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

export function getPublicHolidayDaysForPolicy(
    year: number,
    month: number,
    policy: Pick<TRestLeavePolicy, 'holidayCountry' | 'holidayRegion'>,
): TDay[] {
    const {holidayCountry: country, holidayRegion: region} = policy;

    if (!country || (country === 'GB' && !region)) return [];

    const cacheKey = `${country}:${region ?? 'national'}:${year}:${month}`;
    const cachedDays = publicHolidayDaysCache.get(cacheKey);

    if (cachedDays) return cachedDays;

    const holidayDates = new Set<number>();
    const yearsToLoad = month === 1 ? [year - 1, year] : [year];

    yearsToLoad.forEach((holidayYear) => {
        getPublicHolidaysForYear(country, region, holidayYear).forEach((holiday) => {
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

export function calculateRestTargetForPolicy(policy: TRestLeavePolicy, year: number, month: number) {
    if (!policy.enabled || !policy.includeHolidays) return calculateBaseRestTarget(policy, year, month);

    return calculateRestTargetFromDays(policy, year, month, getPublicHolidayDaysForPolicy(year, month, policy));
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
