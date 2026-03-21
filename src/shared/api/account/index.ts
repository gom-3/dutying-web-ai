import axiosInstance from '../client';
import {type TWardResponse} from '../ward/type';
import {type TAccountResponse, type TEditProfileRequest, type IAccountAPI} from './type';

class AccountAPI implements IAccountAPI {
    getAccount = async (accountId: number) => (await axiosInstance.get<TAccountResponse>(`/accounts/v2/${accountId}`)).data;
    getAccountMe = async () => (await axiosInstance.get<TAccountResponse>('/accounts/me')).data;
    getAccountMeWaiting = async () => (await axiosInstance.get<TWardResponse>(`/accounts/waiting`)).data;
    getDefaultProfileImages = async (): Promise<string[]> =>
        (await axiosInstance.get<{id: number; url: string}[]>(`/accounts/default-images`)).data.map((image) => image.url);
    editAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.put<TAccountResponse>(`/accounts/v2/${accountId}`, dto)).data;
    editAccountStatus = async (accountId: number, status: TAccountResponse['status']) =>
        (await axiosInstance.patch<TAccountResponse>(`/accounts/${accountId}/status?status=${status}`)).data;
    initAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
        (await axiosInstance.patch<TAccountResponse>(`/accounts/v2/${accountId}/init`, dto)).data;
    deleteAccount = async (accountId: number) => (await axiosInstance.delete<void>(`/accounts/${accountId}`)).data;
}

export default new AccountAPI();
