import axios, {AxiosHeaders} from 'axios';
import i18n from 'i18next';
import {toast} from 'react-hot-toast';
import {match} from 'ts-pattern';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {buildApiLocaleHeaders, getStoredServiceRegion} from '@/shared/i18n/locale';
import {emitScheduleRosterChanged, normalizeApiErrorResponse, resolveApiErrorMessage, type TApiClientError} from './error';

declare module 'axios' {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Axios module augmentation must use the library interface name.
    interface AxiosRequestConfig {
        suppressErrorToast?: boolean;
        billingReturnAuthRetried?: boolean;
    }
}

const AUTH_REDIRECT_IGNORED_PATHS = new Set(['/demo/start', '/token/refresh', '/token/blacklist']);
const AUTH_REDIRECT_IGNORED_PREFIXES = ['/auth/'];
const BILLING_RETURN_PATH = '/workspace/billing-return';

let billingReturnRefresh: Promise<string> | undefined;

type TAdminSessionRecovery = {
    current: () => {isAuth: boolean; accessToken: string | null; principalId: number | null};
    principalId: (token: string | null | undefined) => number | null;
    applyAccessToken: (token: string) => void;
};

let adminSessionRecovery: TAdminSessionRecovery | undefined;

/** The auth layer supplies session state without making shared API clients import the store. */
export const registerAdminSessionRecovery = (recovery: TAdminSessionRecovery) => {
    adminSessionRecovery = recovery;
};

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
// Cookie refresh deliberately has no response interceptor, so its rejection cannot recurse.
const billingRefreshInstance = applyRequestInterceptor(createAxiosInstance());
const billingSessionChanged = () =>
    Object.assign(new Error('결제 확인 중 로그인 상태가 변경되었습니다. 다시 로그인한 뒤 결제 결과를 확인해 주세요.'), {
        response: {status: 401},
    });
const refreshBillingReturnSession = () => {
    if (billingReturnRefresh) return billingReturnRefresh;

    billingReturnRefresh = (async () => {
        const recovery = adminSessionRecovery;

        if (!recovery) throw billingSessionChanged();

        const session = recovery.current();
        const previousToken = session.accessToken;
        const accountId = session.principalId;

        if (!session.isAuth || !previousToken || accountId === null || window.location.pathname !== BILLING_RETURN_PATH)
            throw billingSessionChanged();

        const response = await billingRefreshInstance.post<{accessToken: string}>('/auth/admin/token/refresh', undefined, {timeout: 15000});
        const token = response.data?.accessToken;
        const current = recovery.current();

        if (
            typeof token !== 'string' ||
            recovery.principalId(token) !== accountId ||
            !current.isAuth ||
            current.accessToken !== previousToken ||
            window.location.pathname !== BILLING_RETURN_PATH
        )
            throw billingSessionChanged();

        // Preserve the account/ward and React Query state; login bootstrap would reset them.
        recovery.applyAccessToken(token);
        setAccessToken(token);
        setAdminAccessToken(token);

        return token;
    })().finally(() => {
        billingReturnRefresh = undefined;
    });

    return billingReturnRefresh;
};
const applyResponseInterceptor = (instance: ReturnType<typeof createAxiosInstance>) => {
    instance.interceptors.response.use(
        (response) => response,
        // Handle each response error by status.
        async (error) => {
            const preserveDocument = window.location.pathname === BILLING_RETURN_PATH;

            if (
                preserveDocument &&
                error?.response?.status === 401 &&
                shouldRedirectToRefreshOnUnauthorized(error?.config?.url) &&
                error.config &&
                !error.config.billingReturnAuthRetried &&
                instance.defaults.withCredentials !== false
            ) {
                let token: string | undefined;

                try {
                    const requestedBearer = AxiosHeaders.from(error.config.headers).get('Authorization');
                    const currentBearer = instance.defaults.headers.common['Authorization'];

                    if (typeof currentBearer === 'string' && currentBearer !== requestedBearer && currentBearer.startsWith('Bearer ')) {
                        // Another request already refreshed while this stale response was in flight.
                        const recovery = adminSessionRecovery;
                        const current = recovery?.current();
                        const requestedToken = typeof requestedBearer === 'string' ? requestedBearer.replace(/^Bearer /, '') : '';

                        if (
                            !current?.isAuth ||
                            current.principalId === null ||
                            recovery?.principalId(requestedToken) !== current.principalId ||
                            `Bearer ${current.accessToken}` !== currentBearer ||
                            window.location.pathname !== BILLING_RETURN_PATH
                        )
                            throw billingSessionChanged();

                        token = current.accessToken ?? undefined;
                    } else token = await refreshBillingReturnSession();
                } catch (refreshError) {
                    error = refreshError;
                }

                if (token) {
                    error.config.billingReturnAuthRetried = true;
                    error.config.headers = AxiosHeaders.from(error.config.headers);
                    error.config.headers.set('Authorization', `Bearer ${token}`);

                    return instance.request(error.config);
                }
            }

            const status: number | undefined = error?.response?.status;
            const responseBody = normalizeApiErrorResponse(error?.response?.data);
            const message = resolveApiErrorMessage(responseBody, i18n.t('shared.api.requestFailed'));

            // 명단이 변경된 사이 저장/검증을 시도한 경우 작성 화면이 최신 workspace를 다시 읽게 한다.
            // 자동 재저장이나 재확정은 이 계층에서 하지 않는다.
            emitScheduleRosterChanged(responseBody);

            if (status === 403 && ['SCOPE_ACCESS_DENIED', 'WARD_ADMIN_MEMBERSHIP_REQUIRED'].includes(responseBody?.code ?? ''))
                window.dispatchEvent(new Event('dutying:scope-access-revoked'));

            match(status)
                .with(401, () => {
                    if (!preserveDocument && shouldRedirectToRefreshOnUnauthorized(error?.config?.url)) {
                        const next = `${window.location.pathname}${window.location.search}`;

                        location.replace(`${ROUTE.REFRESH}?next=${encodeURIComponent(next)}`);
                    }
                })
                .with(400, 404, () => {
                    if (!error?.config?.suppressErrorToast) toast.error(message);
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
