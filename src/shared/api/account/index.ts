import {type TAccount} from '@/entities/account';
import {type TWard} from '@/entities/ward';
import axiosInstance from '../client';
import {type TEditProfileRequest, type IAccountAPI} from './type';

class AccountAPI implements IAccountAPI {
    getAccount = async (accountId: number) => (await axiosInstance.get<TAccount>(`/accounts/v2/${accountId}`)).data;
    getAccountMe = async () => (await axiosInstance.get<TAccount>('/accounts/me')).data;
    getAccountMeWaiting = async () => (await axiosInstance.get<TWard>(`/accounts/waiting`)).data;
    getDefaultProfileImages = async (): Promise<string[]> =>
        (await axiosInstance.get<{id: number; url: string}[]>(`/accounts/default-images`)).data.map((image) => image.url);
    editAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.put<TAccount>(`/accounts/v2/${accountId}`, dto)).data;
    editAccountStatus = async (accountId: number, status: TAccount['status']) =>
        (await axiosInstance.patch<TAccount>(`/accounts/${accountId}/status?status=${status}`)).data;
    initAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.patch<TAccount>(`/accounts/v2/${accountId}/init`, dto)).data;
    deleteAccount = async (accountId: number) => (await axiosInstance.delete<void>(`/accounts/${accountId}`)).data;
}

export default new AccountAPI();
