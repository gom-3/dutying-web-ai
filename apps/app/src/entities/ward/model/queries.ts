import {queryOptions} from '@tanstack/react-query';
import {WardAPI} from '@/shared/api';

export const WAITING_NURSES_REFETCH_INTERVAL_MS = 30_000;

export const wardQueryKeys = {
    all: () => ['ward'],
    // Ward
    id: (wardId: number) => [...wardQueryKeys.all(), 'id', wardId],
    searched: (code: string) => [...wardQueryKeys.all(), 'searched', code],
    waitingNurses: (wardId: number) => [...wardQueryKeys.all(), 'waitingNurses', wardId],
    constraint: (wardId: number, shiftTeamId: number) => [...wardQueryKeys.all(), 'constraint', wardId, shiftTeamId],
    constraintAll: (wardId: number) => [...wardQueryKeys.all(), 'constraint', wardId],
    // Shift
    duty: (wardId: number, shiftTeamId: number, year: number, month: number) => [
        ...wardQueryKeys.all(),
        'duty',
        wardId,
        shiftTeamId,
        year,
        month,
    ],
    dutyAll: (wardId: number) => [...wardQueryKeys.all(), 'duty', wardId],
    request: (wardId: number, shiftTeamId: number, year: number, month: number) => [
        ...wardQueryKeys.all(),
        'request',
        wardId,
        shiftTeamId,
        year,
        month,
    ],
    requestAll: (wardId: number) => [...wardQueryKeys.all(), 'request', wardId],
    requestList: (wardId: number, shiftTeamId: number, year: number, month: number) => [
        ...wardQueryKeys.all(),
        'requestList',
        wardId,
        shiftTeamId,
        year,
        month,
    ],
    requestListAll: (wardId: number) => [...wardQueryKeys.all(), 'requestList', wardId],
    requestPendingCount: (wardId: number) => [...wardQueryKeys.all(), 'requestPendingCount', wardId],
    requestReceptionSettings: (wardId: number) => [...wardQueryKeys.all(), 'requestReceptionSettings', wardId],
    shift: () => [...wardQueryKeys.all(), 'shift'],
    // ShiftTeam
    shiftTeams: (wardId: number) => [...wardQueryKeys.all(), 'shiftTeams', wardId],
    shiftTeamNurses: (wardId: number, shiftTeamId: number) => [...wardQueryKeys.all(), 'shiftTeamNurses', wardId, shiftTeamId],
    // ShiftType
    shiftTypes: (wardId: number) => [...wardQueryKeys.all(), 'shiftTypes', wardId],
};

export const wardQueryOptions = {
    // Ward
    id: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.id(wardId),
            queryFn: () => WardAPI.getWard(wardId),
        }),
    searched: (code: string) =>
        queryOptions({
            queryKey: wardQueryKeys.searched(code),
            queryFn: () => WardAPI.getWardByCode(code),
        }),
    waitingNurses: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.waitingNurses(wardId),
            queryFn: () => WardAPI.getWaitingNurses(wardId),
            refetchInterval: WAITING_NURSES_REFETCH_INTERVAL_MS,
            refetchIntervalInBackground: false,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
        }),
    constraint: (wardId: number, shiftTeamId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.constraint(wardId, shiftTeamId),
            queryFn: () => WardAPI.getWardConstraint(wardId, shiftTeamId),
        }),
    // Shift
    duty: (wardId: number, shiftTeamId: number, year: number, month: number) =>
        queryOptions({
            queryKey: wardQueryKeys.duty(wardId, shiftTeamId, year, month),
            queryFn: () => WardAPI.getShift(wardId, shiftTeamId, year, month),
        }),
    request: (wardId: number, shiftTeamId: number, year: number, month: number) =>
        queryOptions({
            queryKey: wardQueryKeys.request(wardId, shiftTeamId, year, month),
            queryFn: () => WardAPI.getReqShift(wardId, shiftTeamId, year, month),
        }),
    requestList: (wardId: number, shiftTeamId: number, year: number, month: number) =>
        queryOptions({
            queryKey: wardQueryKeys.requestList(wardId, shiftTeamId, year, month),
            queryFn: () => WardAPI.getRequestList(wardId, shiftTeamId, year, month),
        }),
    requestPendingCount: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.requestPendingCount(wardId),
            queryFn: () => WardAPI.getReqShiftPendingCount(wardId),
        }),
    requestReceptionSettings: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.requestReceptionSettings(wardId),
            queryFn: () => WardAPI.getReqShiftReceptionSettings(wardId),
        }),
    // ShiftTeam
    shiftTeams: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.shiftTeams(wardId),
            queryFn: () => WardAPI.getShiftTeams(wardId),
        }),
    shiftTeamNurses: (wardId: number, shiftTeamId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.shiftTeamNurses(wardId, shiftTeamId),
            queryFn: () => WardAPI.getShiftTeamNurses(wardId, shiftTeamId),
        }),
    // ShiftType
    shiftTypes: (wardId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.shiftTypes(wardId),
            queryFn: () => WardAPI.getShiftTypes(wardId),
        }),
};
