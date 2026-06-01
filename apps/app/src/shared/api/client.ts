import axios from 'axios';
import {toast} from 'react-hot-toast';
import {match} from 'ts-pattern';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';

const createAxiosInstance = () =>
    axios.create({
        baseURL: RUNTIME_CONFIG.serverUrl(),
        headers: {
            'Content-Type': 'application/json',
        },

        withCredentials: true,
    });
const applyResponseInterceptor = (instance: ReturnType<typeof createAxiosInstance>) => {
    instance.interceptors.response.use(
        (response) => response,
        // 에러가 발생하면 각 에러에 대한 처리
        (error) => {
            const status: number | undefined = error?.response?.status;
            const message: string | undefined = error?.response?.data?.message;

            match(status)
                .with(401, () => {
                    if (window.location.pathname !== ROUTE.REFRESH) {
                        const next = `${window.location.pathname}${window.location.search}`;

                        location.replace(`${ROUTE.REFRESH}?next=${encodeURIComponent(next)}`);
                    }
                })
                .with(400, 404, () => {
                    toast.error(message ?? '문제가 생겼어요. 다시 시도해 주세요.');
                })
                .otherwise(() => {
                    // no-op
                });

            const apiError = new Error(message ?? '알 수 없는 오류가 발생했어요.') as Error & {
                code: number;
                originalError: unknown;
            };

            apiError.code = status ?? -1;
            apiError.originalError = error;

            return Promise.reject(apiError);
        },
    );

    return instance;
};
const axiosInstance = applyResponseInterceptor(createAxiosInstance());

export const adminAxiosInstance = applyResponseInterceptor(createAxiosInstance());

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
