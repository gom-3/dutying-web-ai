import {queryOptions} from '@tanstack/react-query';
import {AccountAPI} from '@/shared/api';
import {type TGetAccountShiftListRequest} from '@/shared/api/account';

export const accountQueryKeys = {
    all: () => ['account'],
    me: () => [...accountQueryKeys.all(), 'me'],
    waiting: () => [...accountQueryKeys.all(), 'waiting'],
    searched: (code: string) => [...accountQueryKeys.all(), 'searched', code],
    defaultProfileImages: () => [...accountQueryKeys.all(), 'default-profile-images'],
    // account shift-types
    shifts: (req: TGetAccountShiftListRequest) => [...accountQueryKeys.all(), 'shiftList', ...Object.values(req)],
    shiftTypes: (accountId: number) => [...accountQueryKeys.all(), 'shiftTypes', accountId],
    shiftType: (accountId: number, accountShiftTypeId: number) => [...accountQueryKeys.shiftTypes(accountId), accountShiftTypeId],
};

export const accountQueryOptions = {
    me: () =>
        queryOptions({
            queryKey: accountQueryKeys.me(),
            queryFn: () => AccountAPI.getAccountMe(),
        }),
    waiting: () =>
        queryOptions({
            queryKey: accountQueryKeys.waiting(),
            queryFn: () => AccountAPI.getAccountMeWaiting(),
        }),
    searched: (code: string) =>
        queryOptions({
            queryKey: accountQueryKeys.searched(code),
            queryFn: () => AccountAPI.getAccountByCode(code),
        }),
    defaultProfileImages: () =>
        queryOptions({
            queryKey: accountQueryKeys.defaultProfileImages(),
            queryFn: () => AccountAPI.getDefaultProfileImages(),
            staleTime: 'static',
        }),
    shifts: (req: TGetAccountShiftListRequest) =>
        queryOptions({
            queryKey: accountQueryKeys.shifts(req),
            queryFn: () => AccountAPI.getAccountShifts(req),
        }),
    shiftTypes: (accountId: number) =>
        queryOptions({
            queryKey: accountQueryKeys.shiftTypes(accountId),
            queryFn: () => AccountAPI.getAccountShiftTypes(accountId),
        }),
    shiftType: (accountId: number, accountShiftTypeId: number) =>
        queryOptions({
            queryKey: accountQueryKeys.shiftType(accountId, accountShiftTypeId),
            queryFn: () => AccountAPI.getAccountShiftType(accountId, accountShiftTypeId),
        }),
};
