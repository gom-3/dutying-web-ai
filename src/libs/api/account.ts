import {type Account} from '@/types/account';
import {type Ward} from '@/types/ward';
import axiosInstance from './client';

type TEditProfileRequest = {
    accountId: number;
    name: string;
    profileImgUrl?: string;
    defaultProfileImgId?: number;
};

const getAccount = async (accountId: number) => (await axiosInstance.get<Account>(`/accounts/v2/${accountId}`)).data;
const getAccountMeWaiting = async () => (await axiosInstance.get<Ward>(`/accounts/waiting`)).data;
const editAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
    (await axiosInstance.put<Account>(`/accounts/v2/${accountId}`, dto)).data;
const eidtAccountStatus = async (accountId: number, status: Account['status']) =>
    (await axiosInstance.patch<Account>(`/accounts/${accountId}/status?status=${status}`)).data;
const initAccount = async ({accountId, ...dto}: TEditProfileRequest) =>
    (await axiosInstance.patch<Account>(`/accounts/v2/${accountId}/init`, dto)).data;
const deleteAccount = async (accountId: number) => (await axiosInstance.delete<Account>(`/accounts/${accountId}`)).data;
const getDefaultProfileImages = async (): Promise<string[]> =>
    (await axiosInstance.get<{id: number; url: string}[]>(`/accounts/default-images`)).data.map((image) => image.url);

export default {getAccount, getAccountMeWaiting, editAccount, eidtAccountStatus, initAccount, deleteAccount, getDefaultProfileImages};
