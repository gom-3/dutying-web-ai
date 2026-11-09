import axios from 'axios';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {isWardAdminAccessToken} from './admin-token';

export async function createPersonalAccountSession() {
    const refresh = axios.create({baseURL: RUNTIME_CONFIG.serverUrl(), withCredentials: true});
    const {data: token} = await refresh.post<{accessToken: string}>('/token/refresh');

    if (!token || typeof token.accessToken !== 'string' || !token.accessToken || isWardAdminAccessToken(token.accessToken))
        throw new Error('Personal account required');

    const client = axios.create({
        baseURL: RUNTIME_CONFIG.serverUrl(),
        withCredentials: false,
        headers: {Authorization: `Bearer ${token.accessToken}`},
    });
    const {data: account} = await client.get<{accountId: number; status: string; name: string; email?: string}>('/accounts/me');

    if (!account || !Number.isSafeInteger(account.accountId) || account.accountId <= 0 || typeof account.status !== 'string')
        throw new Error('Personal account required');

    return {account, client};
}
