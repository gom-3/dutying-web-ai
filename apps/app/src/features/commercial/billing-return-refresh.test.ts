import type {AxiosAdapter, AxiosError as AxiosErrorType, AxiosHeaders as AxiosHeadersType, InternalAxiosRequestConfig} from 'axios';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type AuthStore from '@/features/auth/model/store';
import {
    captureBillingReturnPayload,
    clearBillingReturnPayload,
    readBillingReturnPayload,
} from '@/features/commercial/billing-return-payload';
import type * as ApiClient from '@/shared/api/client';

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
const originalLocation = window.location;
const callback =
    '/workspace/billing-return?orderId=order-fixture&registration=registration-fixture&authKey=authorization-fixture&customerKey=customer-fixture';
const token = (accountId: number, version: string) =>
    `header.${btoa(JSON.stringify({principalType: 'WARD_ADMIN', wardAdminAccountId: accountId, version}))}.signature`;
const expiredToken = token(7, 'expired');
const freshToken = token(7, 'refreshed');
const replace = vi.fn();

let adapter: AxiosAdapter;
let client: typeof ApiClient;
let authStore: typeof AuthStore;
let AxiosError: typeof AxiosErrorType;
let AxiosHeaders: typeof AxiosHeadersType;

const response = (config: InternalAxiosRequestConfig, data: unknown) => ({config, data, status: 200, statusText: 'OK', headers: {}});
const unauthorized = (config: InternalAxiosRequestConfig, status = 401) =>
    new AxiosError(
        'Request rejected',
        'ERR_BAD_REQUEST',
        config,
        {},
        {config, data: {message: 'Session rejected'}, status, statusText: 'Error', headers: {}},
    );
const bearer = (config: InternalAxiosRequestConfig) => AxiosHeaders.from(config.headers).get('Authorization');
const refreshRequest = (config: InternalAxiosRequestConfig) => config.url === '/auth/admin/token/refresh';
const assertCallbackPrivate = () => {
    expect(window.location.pathname + window.location.search).toBe('/workspace/billing-return?orderId=order-fixture');
    expect(readBillingReturnPayload(window.location.search).get('authKey')).toBe('authorization-fixture');
    expect(JSON.stringify({...localStorage, ...sessionStorage})).not.toMatch(/authorization-fixture|customer-fixture|registration-fixture/);
    expect(replace).not.toHaveBeenCalled();
};

beforeEach(async () => {
    vi.resetModules();
    replace.mockClear();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', callback);
    captureBillingReturnPayload();
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...originalLocation,
            get pathname() {
                return originalLocation.pathname;
            },
            get search() {
                return originalLocation.search;
            },
            replace,
        },
    });

    const axios = await import('axios');

    AxiosError = axios.AxiosError;
    AxiosHeaders = axios.AxiosHeaders;
    adapter = vi.fn(async (config) => {
        if (refreshRequest(config)) return response(config, {accessToken: freshToken});

        if (bearer(config) === `Bearer ${expiredToken}`) throw unauthorized(config);

        return response(config, {ok: true});
    });
    axios.default.defaults.adapter = (config) => adapter(config);
    client = await import('@/shared/api/client');
    authStore = (await import('@/features/auth/model/store')).default;
    authStore.setState({isAuth: true, accessToken: expiredToken, accountId: 7, wardId: 11, accountMeStatus: 'success'});
});
afterEach(() => {
    clearBillingReturnPayload();
    Object.defineProperty(window, 'location', locationDescriptor);
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    sessionStorage.clear();
});

describe('billing callback session recovery', () => {
    it('refreshes an expired bootstrap token without reloading or losing the in-memory authorization', async () => {
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).resolves.toMatchObject({data: {ok: true}});
        expect(authStore.getState()).toMatchObject({
            accessToken: freshToken,
            accountId: 7,
            wardId: 11,
            accountMeStatus: 'success',
            isAuth: true,
        });

        const requests = vi.mocked(adapter).mock.calls.map(([config]) => config);
        const refresh = requests.filter(refreshRequest);

        expect(refresh).toHaveLength(1);
        expect(refresh[0]).toMatchObject({withCredentials: true, timeout: 15000});
        expect(bearer(refresh[0])).toBeUndefined();
        expect(requests.filter((config) => !refreshRequest(config))).toHaveLength(2);
        assertCallbackPrivate();
    });

    it('shares refresh across bootstrap calls and uses the new token for a late stale 401', async () => {
        let finishRefresh!: () => void;
        let finishLate!: () => void;

        const pendingRefresh = new Promise<void>((resolve) => {
            finishRefresh = resolve;
        });
        const pendingLate = new Promise<void>((resolve) => {
            finishLate = resolve;
        });

        adapter = vi.fn(async (config) => {
            if (refreshRequest(config)) {
                await pendingRefresh;

                return response(config, {accessToken: freshToken});
            }

            if (bearer(config) === `Bearer ${expiredToken}`) {
                if (config.url === '/admin/commercial/orders/late') await pendingLate;

                throw unauthorized(config);
            }

            return response(config, {ok: true});
        });

        const account = client.adminAxiosInstance.get('/admin/accounts/me');
        const context = client.default.get('/admin/commercial/context');
        const late = client.adminAxiosInstance.get('/admin/commercial/orders/late');

        await vi.waitFor(() => expect(vi.mocked(adapter).mock.calls.filter(([config]) => refreshRequest(config))).toHaveLength(1));
        finishRefresh();
        await Promise.all([account, context]);
        finishLate();
        await late;
        expect(vi.mocked(adapter).mock.calls.filter(([config]) => refreshRequest(config))).toHaveLength(1);
        assertCallbackPrivate();
    });

    it.each([401, 503, 'network', 'timeout'] as const)('keeps callback memory after refresh failure %s', async (failure) => {
        adapter = vi.fn(async (config) => {
            if (!refreshRequest(config)) throw unauthorized(config);

            if (typeof failure === 'number') throw unauthorized(config, failure);

            throw new AxiosError(failure, failure === 'timeout' ? 'ECONNABORTED' : 'ERR_NETWORK', config);
        });
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).rejects.toMatchObject({
            code: typeof failure === 'number' ? failure : -1,
        });
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(authStore.getState()).toMatchObject({accessToken: expiredToken, accountId: 7, wardId: 11, isAuth: true});
        assertCallbackPrivate();
    });

    it('can retry after a temporary refresh failure without another card authorization', async () => {
        let failed = false;

        adapter = vi.fn(async (config) => {
            if (refreshRequest(config)) {
                if (!failed) {
                    failed = true;
                    throw unauthorized(config, 503);
                }

                return response(config, {accessToken: freshToken});
            }

            if (bearer(config) === `Bearer ${expiredToken}`) throw unauthorized(config);

            return response(config, {ok: true});
        });
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).rejects.toMatchObject({code: 503});
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).resolves.toMatchObject({data: {ok: true}});
        assertCallbackPrivate();
    });

    it('never loops when the retried request is still unauthorized', async () => {
        adapter = vi.fn(async (config) => {
            if (refreshRequest(config)) return response(config, {accessToken: freshToken});

            throw unauthorized(config);
        });
        await expect(
            client.adminAxiosInstance.post('/admin/commercial/orders/order-fixture/confirm-subscription', {
                authKey: 'authorization-fixture',
            }),
        ).rejects.toMatchObject({code: 401});
        expect(adapter).toHaveBeenCalledTimes(3);
        expect(vi.mocked(adapter).mock.calls.filter(([config]) => refreshRequest(config))).toHaveLength(1);
        assertCallbackPrivate();
    });

    it.each(['logout', 'account-switch', 'navigation'] as const)('does not apply a late refresh after %s', async (change) => {
        let finish!: () => void;

        const pending = new Promise<void>((resolve) => {
            finish = resolve;
        });

        adapter = vi.fn(async (config) => {
            if (refreshRequest(config)) {
                await pending;

                return response(config, {accessToken: freshToken});
            }

            throw unauthorized(config);
        });

        const request = client.adminAxiosInstance.get('/admin/accounts/me');
        const rejected = expect(request).rejects.toMatchObject({code: 401});

        await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));

        if (change === 'logout') authStore.setState({isAuth: false, accessToken: null});

        if (change === 'account-switch') authStore.setState({accessToken: token(8, 'different-account'), accountId: 8});

        if (change === 'navigation') window.history.replaceState(null, '', '/profile');

        finish();
        await rejected;
        expect(authStore.getState().accessToken).not.toBe(freshToken);
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(replace).not.toHaveBeenCalled();
    });

    it('does not replay an old account request using a switched account token', async () => {
        adapter = vi.fn(async (config) => {
            authStore.setState({accessToken: token(8, 'different-account'), accountId: 8});
            throw unauthorized(config);
        });
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).rejects.toMatchObject({code: 401});
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
    });

    it('keeps regular protected-route redirects and credential-error handling unchanged', async () => {
        adapter = vi.fn(async (config) => {
            throw unauthorized(config);
        });
        window.history.replaceState(null, '', '/profile?tab=account');
        await expect(client.adminAxiosInstance.get('/admin/accounts/me')).rejects.toMatchObject({code: 401});
        expect(replace).toHaveBeenCalledExactlyOnceWith('/refresh?next=%2Fprofile%3Ftab%3Daccount');
        replace.mockClear();
        await expect(client.default.post('/auth/admin/password/login')).rejects.toMatchObject({code: 401});
        expect(replace).not.toHaveBeenCalled();
        expect(vi.mocked(adapter).mock.calls.filter(([config]) => refreshRequest(config))).toHaveLength(0);
    });

    it('does not refresh or change non-auth request failures', async () => {
        adapter = vi.fn(async (config) => {
            throw unauthorized(config, 403);
        });
        await expect(client.adminAxiosInstance.get('/admin/commercial/context')).rejects.toMatchObject({code: 403});
        expect(adapter).toHaveBeenCalledTimes(1);
        assertCallbackPrivate();
    });
});
