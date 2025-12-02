import {queryOptions} from '@tanstack/react-query';
import {WardAPI} from '@/shared/api';

export const wardQueryKeys = {
    all: () => ['ward'],
    searched: (code: string) => [...wardQueryKeys.all(), 'searched', code],
    duty: (wardId: number, shiftTeamId: number, year: number, month: number) => [
        ...wardQueryKeys.all(),
        'duty',
        wardId,
        shiftTeamId,
        year,
        month,
    ],
    request: (wardId: number, shiftTeamId: number, year: number, month: number) => [
        ...wardQueryKeys.all(),
        'request',
        wardId,
        shiftTeamId,
        year,
        month,
    ],
    linkedAccounts: (wardId: number, shiftTeamId: number) => [...wardQueryKeys.all(), 'linkedAccounts', wardId, shiftTeamId],
};

export const wardQueryOptions = {
    searched: (code: string) =>
        queryOptions({
            queryKey: wardQueryKeys.searched(code),
            queryFn: () => WardAPI.getWardByCode(code),
        }),
    duty: (wardId: number, shiftTeamId: number, year: number, month: number) =>
        queryOptions({
            queryKey: wardQueryKeys.duty(wardId, shiftTeamId, year, month),
            queryFn: () => WardAPI.getWardDuty(wardId, shiftTeamId, year, month),
        }),
    request: (wardId: number, shiftTeamId: number, year: number, month: number) =>
        queryOptions({
            queryKey: wardQueryKeys.request(wardId, shiftTeamId, year, month),
            queryFn: () => WardAPI.getWardRequest(wardId, shiftTeamId, year, month),
        }),
    linkedAccounts: (wardId: number, shiftTeamId: number) =>
        queryOptions({
            queryKey: wardQueryKeys.linkedAccounts(wardId, shiftTeamId),
            queryFn: () => WardAPI.getWardMembers(wardId, shiftTeamId),
        }),
};
