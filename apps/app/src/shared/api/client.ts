import axios, {AxiosHeaders} from 'axios';
import i18n from 'i18next';
import {toast} from 'react-hot-toast';
import {match} from 'ts-pattern';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {buildApiLocaleHeaders, getStoredServiceRegion} from '@/shared/i18n/locale';
import {normalizeApiErrorResponse, resolveApiErrorMessage, type TApiClientError} from './error';

const AUTH_REDIRECT_IGNORED_PATHS = new Set(['/demo/start', '/token/refresh', '/token/blacklist']);
const AUTH_REDIRECT_IGNORED_PREFIXES = ['/auth/'];
const createAxiosInstance = (options: {withCredentials?: boolean} = {}) =>
    axios.create({
        baseURL: RUNTIME_CONFIG.serverUrl(),
        headers: {
            'Content-Type': 'application/json',
        },

        withCredentials: options.withCredentials ?? true,
    });
const getRequestPathname = (requestUrl?: string) => {
    if (!requestUrl) return '';

    try {
        return new URL(requestUrl, 'http://dutying.local').pathname;
    } catch {
        return requestUrl.split('?')[0] ?? '';
    }
};

export const shouldRedirectToRefreshOnUnauthorized = (requestUrl: string | undefined, currentPathname = window.location.pathname) => {
    if (currentPathname === ROUTE.REFRESH) return false;

    const requestPathname = getRequestPathname(requestUrl);

    if (AUTH_REDIRECT_IGNORED_PATHS.has(requestPathname)) return false;

    return !AUTH_REDIRECT_IGNORED_PREFIXES.some((prefix) => requestPathname.startsWith(prefix));
};

const applyRequestInterceptor = (instance: ReturnType<typeof createAxiosInstance>) => {
    instance.interceptors.request.use((config) => {
        const headers = AxiosHeaders.from(config.headers);
        const localeHeaders = buildApiLocaleHeaders(i18n.resolvedLanguage ?? i18n.language, getStoredServiceRegion());

        Object.entries(localeHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });

        config.headers = headers;

        return config;
    });

    return instance;
};
const applyResponseInterceptor = (instance: ReturnType<typeof createAxiosInstance>) => {
    instance.interceptors.response.use(
        (response) => response,
        // Handle each response error by status.
        (error) => {
            const status: number | undefined = error?.response?.status;
            const responseBody = normalizeApiErrorResponse(error?.response?.data);
            const message = resolveApiErrorMessage(responseBody, i18n.t('shared.api.requestFailed'));

            match(status)
                .with(401, () => {
                    if (shouldRedirectToRefreshOnUnauthorized(error?.config?.url)) {
                        const next = `${window.location.pathname}${window.location.search}`;

                        location.replace(`${ROUTE.REFRESH}?next=${encodeURIComponent(next)}`);
                    }
                })
                .with(400, 404, () => {
                    toast.error(message);
                })
                .otherwise(() => {
                    // no-op
                });

            const apiError = new Error(message ?? i18n.t('shared.api.unknownError')) as TApiClientError;

            apiError.code = status ?? -1;
            apiError.serverCode = responseBody?.code;
            apiError.messageKey = responseBody?.messageKey;
            apiError.displayPolicy = responseBody?.displayPolicy;
            apiError.requestId = responseBody?.requestId;
            apiError.traceId = responseBody?.traceId;
            apiError.responseBody = responseBody;
            apiError.originalError = error;

            return Promise.reject(apiError);
        },
    );

    return instance;
};
const applyInterceptors = (instance: ReturnType<typeof createAxiosInstance>) => applyResponseInterceptor(applyRequestInterceptor(instance));
const axiosInstance = applyInterceptors(createAxiosInstance());

export const adminAxiosInstance = applyInterceptors(createAxiosInstance());
export const publicAxiosInstance = applyInterceptors(createAxiosInstance({withCredentials: false}));

const setBearerToken = (instance: ReturnType<typeof createAxiosInstance>, token: string) => {
    if (token) {
        instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        return;
    }

    delete instance.defaults.headers.common['Authorization'];
};

export const setAccessToken = (token: string) => {
    setBearerToken(axiosInstance, token);
};

export const setAdminAccessToken = (token: string) => {
    setBearerToken(adminAxiosInstance, token);
};

export default axiosInstance;
