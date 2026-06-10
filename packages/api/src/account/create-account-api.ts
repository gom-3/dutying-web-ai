import type {IApiClient} from '../client';
import type {
    IAccountAPI,
    TAccountResponse,
    TDefaultProfileImageResponse,
    TEditProfileRequest,
    TUpdateAccountPreferencesRequest,
} from './contracts';
import type {TWardResponse} from '../ward';

export const createAccountApi = (client: IApiClient): IAccountAPI => ({
    getAccount: async (accountId) => (await client.get<TAccountResponse>(`/accounts/v2/${accountId}`)).data,
    getAccountMe: async () => (await client.get<TAccountResponse>('/accounts/me')).data,
    getAccountMeWaiting: async () => (await client.get<TWardResponse>(`/accounts/waiting`)).data,
    getDefaultProfileImages: async () => (await client.get<TDefaultProfileImageResponse[]>(`/accounts/default-images`)).data,
    editAccount: async ({accountId, ...dto}: TEditProfileRequest) =>
        (await client.put<TAccountResponse>(`/accounts/v2/${accountId}`, dto)).data,
    editAccountStatus: async (accountId, status) =>
        (await client.patch<TAccountResponse>(`/accounts/${accountId}/status?status=${status}`)).data,
    initAccount: async ({accountId, ...dto}: TEditProfileRequest) =>
        (await client.patch<TAccountResponse>(`/accounts/v2/${accountId}/init`, dto)).data,
    updatePreferences: async (dto: TUpdateAccountPreferencesRequest) =>
        (await client.patch<TAccountResponse>('/accounts/me/preferences', dto)).data,
    deleteAccount: async (accountId) => (await client.delete<void>(`/accounts/${accountId}`)).data,
    markTutorialSeen: async (tutorialKey) => (await client.post<void>(`/accounts/me/tutorials/${tutorialKey}/seen`)).data,
});
