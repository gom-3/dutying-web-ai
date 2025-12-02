import {type Account} from '@/shared/types/account';
import {type Ward} from '@/shared/types/ward';
import axiosInstance from '../client';
import {type TEditProfileRequest, type IAccountAPI} from './type';

class AccountAPI implements IAccountAPI {
    getAccount = async (accountId: number) => (await axiosInstance.get<Account>(`/accounts/v2/${accountId}`)).data;
    getAccountMeWaiting = async () => (await axiosInstance.get<Ward>(`/accounts/waiting`)).data;
    getDefaultProfileImages = async (): Promise<string[]> =>
        (await axiosInstance.get<{id: number; url: string}[]>(`/accounts/default-images`)).data.map((image) => image.url);
    editAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.put<Account>(`/accounts/v2/${accountId}`, dto)).data;
    editAccountStatus = async (accountId: number, status: Account['status']) =>
        (await axiosInstance.patch<Account>(`/accounts/${accountId}/status?status=${status}`)).data;
    initAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.patch<Account>(`/accounts/v2/${accountId}/init`, dto)).data;
    deleteAccount = async (accountId: number) => (await axiosInstance.delete<void>(`/accounts/${accountId}`)).data;
}

export default new AccountAPI();
