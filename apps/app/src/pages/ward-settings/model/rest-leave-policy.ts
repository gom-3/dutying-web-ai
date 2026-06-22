import {useCallback, useEffect, useState} from 'react';
import type {TWardShiftType} from '@/entities';
import {normalizePreferredLanguage} from '@/shared/i18n/locale';

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

export function getApproximateWeekCount(year: number, month: number) {
    return Math.ceil(getDaysInMonth(year, month) / 7);
}

export function getHolidayCountryForLanguage(language?: string | null): THolidayCountry {
    const normalizedLanguage = normalizePreferredLanguage(language) ?? 'en';

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

export function calculateBaseRestTarget(policy: TRestLeavePolicy, year: number, month: number) {
    if (!policy.enabled) return 0;

    if (policy.targetMode === 'fixed') return policy.fixedMonthlyOffDays;

    return getApproximateWeekCount(year, month) * policy.weeklyOffDays;
}

export function calculateRestTarget(policy: TRestLeavePolicy, year: number, month: number, holidayCount = 0) {
    if (!policy.enabled) return 0;

    return calculateBaseRestTarget(policy, year, month) + (policy.includeHolidays ? holidayCount : 0);
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
