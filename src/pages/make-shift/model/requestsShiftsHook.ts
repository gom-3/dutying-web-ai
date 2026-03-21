import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback, useMemo, useState} from 'react';
import {type TDutyRequest, type TRequestShift, type TWardShiftType} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import WardAPI from '@/shared/api/ward';
import {useMakeShiftStore} from './make-shift-store';

function buildShiftTypeMap(shiftTypes: TWardShiftType[] | undefined): Map<number, TWardShiftType> {
    const map = new Map<number, TWardShiftType>();

    if (!shiftTypes) return map;

    for (const t of shiftTypes) map.set(t.wardShiftTypeId, t);

    return map;
}

function normalizeShiftTypes(input: unknown): TWardShiftType[] | undefined {
    if (Array.isArray(input)) return input as TWardShiftType[];

    if (input && typeof input === 'object') {
        const maybe = input as {shiftTypes?: unknown; wardShiftTypes?: unknown};

        if (Array.isArray(maybe.shiftTypes)) return maybe.shiftTypes as TWardShiftType[];

        if (Array.isArray(maybe.wardShiftTypes)) return maybe.wardShiftTypes as TWardShiftType[];
    }

    return undefined;
}

export function useRequestsShiftsHook() {
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const queryClient = useQueryClient();
    const [updatingRequestId, setUpdatingRequestId] = useState<number | null>(null);
    const requestEnabled = wardId !== null && currentShiftTeamId !== null;
    const shiftTypesEnabled = wardId !== null;
    const requestQuery = useQuery({
        ...wardQueryOptions.request(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled: requestEnabled,
    });
    const requestQueryKey = wardQueryOptions.request(wardId ?? -1, currentShiftTeamId ?? -1, year, month).queryKey;
    const requestListQuery = useQuery({
        ...wardQueryOptions.requestList(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled: requestEnabled,
    });
    const requestListQueryKey = wardQueryOptions.requestList(wardId ?? -1, currentShiftTeamId ?? -1, year, month).queryKey;
    const shiftTypesQuery = useQuery({
        ...wardQueryOptions.shiftTypes(wardId ?? -1),
        enabled: shiftTypesEnabled,
        staleTime: 1000 * 60 * 5,
    });
    // requestShift API가 wardShiftTypes를 포함하는 경우가 많아서, shiftTypes가 아직 없으면 requestShift의 값을 fallback으로 씁니다.
    const shiftTypeSourceRaw = shiftTypesQuery.data ?? requestQuery.data?.wardShiftTypes ?? undefined;
    const shiftTypeSource = useMemo(() => normalizeShiftTypes(shiftTypeSourceRaw), [shiftTypeSourceRaw]);
    const wardShiftTypeMap = useMemo(() => buildShiftTypeMap(shiftTypeSource), [shiftTypeSource]);
    const requestList = useMemo(() => requestListQuery.data ?? [], [requestListQuery.data]);
    const acceptedRequests = useMemo(() => requestList.filter((item) => item.isAccepted === true), [requestList]);
    const pendingRequests = useMemo(() => requestList.filter((item) => item.isAccepted === null), [requestList]);
    const queryError = requestQuery.error ?? requestListQuery.error ?? shiftTypesQuery.error;
    const decideRequest = useCallback(
        async (wardReqShiftId: number, isAccepted: boolean | null) => {
            if (wardId === null) return;

            setUpdatingRequestId(wardReqShiftId);

            try {
                await WardAPI.acceptRequestShift(wardId, wardReqShiftId, isAccepted);
                await Promise.all([
                    queryClient.invalidateQueries({queryKey: requestQueryKey}),
                    queryClient.invalidateQueries({queryKey: requestListQueryKey}),
                ]);
            } finally {
                setUpdatingRequestId((prev) => (prev === wardReqShiftId ? null : prev));
            }
        },
        [queryClient, requestListQueryKey, requestQueryKey, wardId],
    );

    return {
        state: {
            wardId,
            year,
            month,
            currentShiftTeamId,
            requestShift: (requestQuery.data ?? null) as TRequestShift | null,
            requestList: requestList as TDutyRequest[],
            wardShiftTypeMap,
            acceptedRequests,
            pendingRequests,
        },
        status: {
            loading: requestQuery.isLoading || requestListQuery.isLoading || shiftTypesQuery.isLoading,
            error: Boolean(queryError),
            updatingRequestId,
        },
        actions: {
            decideRequest,
        },
    };
}
