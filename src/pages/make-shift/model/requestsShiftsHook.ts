import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {type DutyRequest} from '@/shared/types/request';
import {type RequestShift} from '@/shared/types/shift';
import {type TWardShiftType} from '@/shared/types/ward';
import {useMakeShiftStore} from './make-shift-store';

export type TAppliedRequest = {
    nurseName: string;
    date: number; // 1~31
    wardShiftTypeId: number;
};

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

function buildAppliedRequests(requestShift: RequestShift | null | undefined): TAppliedRequest[] {
    if (!requestShift) return [];

    const out: TAppliedRequest[] = [];

    for (const division of requestShift.divisionShiftNurses) {
        for (const row of division) {
            for (let i = 0; i < row.wardReqShiftList.length; i += 1) {
                const wardShiftTypeId = row.wardReqShiftList[i];

                if (wardShiftTypeId === null) continue;

                const date = requestShift.days[i]?.day ?? i + 1;

                out.push({
                    nurseName: row.shiftNurse.name,
                    date,
                    wardShiftTypeId,
                });
            }
        }
    }

    // 날짜 우선, 그다음 이름
    out.sort((a, b) => (a.date !== b.date ? a.date - b.date : a.nurseName.localeCompare(b.nurseName)));

    return out;
}

export function useRequestsShiftsHook() {
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const requestEnabled = wardId !== null && currentShiftTeamId !== null;
    const shiftTypesEnabled = wardId !== null;
    const requestQuery = useQuery({
        ...wardQueryOptions.request(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled: requestEnabled,
    });
    const requestListQuery = useQuery({
        ...wardQueryOptions.requestList(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled: requestEnabled,
    });
    const shiftTypesQuery = useQuery({
        ...wardQueryOptions.shiftTypes(wardId ?? -1),
        enabled: shiftTypesEnabled,
        staleTime: 1000 * 60 * 5,
    });
    // requestShift API가 wardShiftTypes를 포함하는 경우가 많아서, shiftTypes가 아직 없으면 requestShift의 값을 fallback으로 씁니다.
    const shiftTypeSourceRaw = shiftTypesQuery.data ?? requestQuery.data?.wardShiftTypes ?? undefined;
    const shiftTypeSource = useMemo(() => normalizeShiftTypes(shiftTypeSourceRaw), [shiftTypeSourceRaw]);
    const wardShiftTypeMap = useMemo(() => buildShiftTypeMap(shiftTypeSource), [shiftTypeSource]);
    const appliedRequests = useMemo(() => buildAppliedRequests(requestQuery.data ?? null), [requestQuery.data]);
    const queryError = requestQuery.error ?? requestListQuery.error ?? shiftTypesQuery.error;

    return {
        state: {
            wardId,
            year,
            month,
            currentShiftTeamId,
            requestShift: (requestQuery.data ?? null) as RequestShift | null,
            requestList: (requestListQuery.data ?? null) as DutyRequest[] | null,
            wardShiftTypeMap,
            appliedRequests,
        },
        status: {
            loading: requestQuery.isLoading || requestListQuery.isLoading || shiftTypesQuery.isLoading,
            error: Boolean(queryError),
        },
    };
}
