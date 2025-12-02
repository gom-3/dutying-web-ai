import {queryOptions} from '@tanstack/react-query';
import {MoimAPI} from '@/shared/api';

export const moimQueryKeys = {
    all: () => ['moim'],
    list: () => [...moimQueryKeys.all(), 'list'],
    id: (moimId: number) => [...moimQueryKeys.all(), 'id', moimId],
    searched: (code: string) => [...moimQueryKeys.all(), 'searched', code],
    collection: (moimId: number, startDate: string, endDate: string) => [...moimQueryKeys.all(), 'collection', moimId, startDate, endDate],
};

export const moimQueryOptions = {
    list: () =>
        queryOptions({
            queryKey: moimQueryKeys.list(),
            queryFn: () => MoimAPI.getMoimList(),
        }),
    id: (moimId: number) =>
        queryOptions({
            queryKey: moimQueryKeys.id(moimId),
            queryFn: () => MoimAPI.getMoimMembers(moimId),
        }),
    searched: (code: string) =>
        queryOptions({
            queryKey: moimQueryKeys.searched(code),
            queryFn: () => MoimAPI.searchMoimCode(code),
        }),
    collection: (moimId: number, startDate: string, endDate: string) =>
        queryOptions({
            queryKey: moimQueryKeys.collection(moimId, startDate, endDate),
            queryFn: () => MoimAPI.getMoimCollection(moimId, startDate, endDate),
        }),
};
