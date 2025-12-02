import {queryOptions} from '@tanstack/react-query';
import {FriendAPI} from '@/shared/api';

export const friendQueryKeys = {
    all: () => ['friend'],
    list: () => [...friendQueryKeys.all(), 'list'],
    searched: (word: string) => [...friendQueryKeys.all(), 'searched', word],
    collection: (startDate: string, endDate: string) => [...friendQueryKeys.all(), 'collection', startDate, endDate],
};

export const friendQueryOptions = {
    list: () =>
        queryOptions({
            queryKey: friendQueryKeys.list(),
            queryFn: () => FriendAPI.getFriendsList(),
        }),
    searched: (word: string) =>
        queryOptions({
            queryKey: friendQueryKeys.searched(word),
            queryFn: () => FriendAPI.getFriendByName(word),
        }),
    collection: (startDate: string, endDate: string) =>
        queryOptions({
            queryKey: friendQueryKeys.collection(startDate, endDate),
            queryFn: () => FriendAPI.getFriendCollection(startDate, endDate),
        }),
};
