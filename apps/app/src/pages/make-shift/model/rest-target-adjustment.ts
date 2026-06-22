import {useCallback, useEffect, useState} from 'react';

const REST_TARGET_ADJUSTMENT_UPDATED_EVENT = 'dutying:make-shift-rest-target-adjustment-updated';

type TRestTargetAdjustmentParams = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
};

type TRestTargetAdjustmentUpdatedEventDetail = Required<TRestTargetAdjustmentParams> & {
    adjustmentDays: number;
};

function getStorageKey({wardId, shiftTeamId, year, month}: Required<TRestTargetAdjustmentParams>) {
    return `make-shift:rest-target-adjustment:${wardId}:${shiftTeamId}:${year}:${month}`;
}

function normalizeAdjustmentDays(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) return 0;

    return Math.min(31, Math.max(-31, Math.round(parsed)));
}

function hasAdjustmentKey(params: TRestTargetAdjustmentParams): params is Required<TRestTargetAdjustmentParams> {
    return params.wardId !== null && params.shiftTeamId !== null;
}

export function loadRestTargetAdjustment(params: TRestTargetAdjustmentParams) {
    if (!hasAdjustmentKey(params) || typeof window === 'undefined') return 0;

    try {
        return normalizeAdjustmentDays(window.localStorage.getItem(getStorageKey(params)));
    } catch {
        return 0;
    }
}

export function saveRestTargetAdjustment(params: TRestTargetAdjustmentParams, adjustmentDays: number) {
    if (!hasAdjustmentKey(params) || typeof window === 'undefined') return;

    const normalized = normalizeAdjustmentDays(adjustmentDays);

    window.localStorage.setItem(getStorageKey(params), String(normalized));
    window.dispatchEvent(
        new CustomEvent<TRestTargetAdjustmentUpdatedEventDetail>(REST_TARGET_ADJUSTMENT_UPDATED_EVENT, {
            detail: {...params, adjustmentDays: normalized},
        }),
    );
}

export function useRestTargetAdjustment(params: TRestTargetAdjustmentParams) {
    const [adjustmentDays, setAdjustmentDaysState] = useState(() => loadRestTargetAdjustment(params));

    useEffect(() => {
        setAdjustmentDaysState(loadRestTargetAdjustment(params));
    }, [params.month, params.shiftTeamId, params.wardId, params.year]);

    useEffect(() => {
        if (!hasAdjustmentKey(params) || typeof window === 'undefined') return;

        const handleAdjustmentUpdated = (event: Event) => {
            const detail = (event as CustomEvent<TRestTargetAdjustmentUpdatedEventDetail>).detail;

            if (
                detail?.wardId !== params.wardId ||
                detail.shiftTeamId !== params.shiftTeamId ||
                detail.year !== params.year ||
                detail.month !== params.month
            ) {
                return;
            }

            setAdjustmentDaysState(detail.adjustmentDays);
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== getStorageKey(params)) return;

            setAdjustmentDaysState(loadRestTargetAdjustment(params));
        };

        window.addEventListener(REST_TARGET_ADJUSTMENT_UPDATED_EVENT, handleAdjustmentUpdated);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener(REST_TARGET_ADJUSTMENT_UPDATED_EVENT, handleAdjustmentUpdated);
            window.removeEventListener('storage', handleStorage);
        };
    }, [params.month, params.shiftTeamId, params.wardId, params.year]);

    const setAdjustmentDays = useCallback(
        (nextAdjustmentDays: number) => {
            const normalized = normalizeAdjustmentDays(nextAdjustmentDays);

            setAdjustmentDaysState(normalized);
            saveRestTargetAdjustment(params, normalized);
        },
        [params],
    );

    return {adjustmentDays, setAdjustmentDays};
}
