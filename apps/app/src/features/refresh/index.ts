import {useCallback} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {isSessionInvalidError, retryOnTransientFailure} from '@/features/auth/model/session-failure';
import axiosInstance from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {withTimeout} from '@/shared/util/with-timeout';

export const REFRESH_DEMO_EXPIRED_REDIRECT_ERROR = 'refresh_demo_expired_redirect';
/** The refresh endpoint could not be reached (network error / gateway 5xx / timeout). The session is kept. */
export const REFRESH_UNAVAILABLE_ERROR = 'refresh_unavailable';
/** The server definitively rejected the refresh token. The session has been cleared. */
export const REFRESH_FAILED_ERROR = 'refresh_failed';

const REFRESH_TIMEOUT_MS = 15000;
const SESSION_EXPIRED_TOAST_ID = 'auth-session-expired';

export default function useRefresh() {
    const {
        state: {isDemoExpired},
        actions: {handleLogout, handleLogin, startDemoSignupTransition},
    } = useAuth();
    const {t} = useTypedTranslation();
    const refresh = useCallback(async () => {
        let refreshResponse: {data: {accessToken: string}};

        try {
            axiosInstance.defaults.headers.common['Authorization'] = undefined;

            refreshResponse = await retryOnTransientFailure(() =>
                withTimeout(axiosInstance.post('/auth/admin/token/refresh'), REFRESH_TIMEOUT_MS, 'refresh_timeout'),
            );
        } catch (error) {
            // Only a definitive rejection (401/403) means the refresh token is gone. A restarting API server
            // (nginx 502/503/504), a dropped connection or a timeout must not throw the stored session away.
            if (!isSessionInvalidError(error)) {
                throw new Error(REFRESH_UNAVAILABLE_ERROR);
            }

            if (isDemoExpired) {
                startDemoSignupTransition();
                throw new Error(REFRESH_DEMO_EXPIRED_REDIRECT_ERROR);
            }

            toast.error(t('feature.auth.sessionExpired'), {id: SESSION_EXPIRED_TOAST_ID});
            await handleLogout();
            throw new Error(REFRESH_FAILED_ERROR);
        }

        const accessToken = refreshResponse.data.accessToken;

        // 여기서는 "세션만 갱신"하고, 이동은 호출자(RefreshPage)가 담당한다.
        handleLogin(accessToken, null, {preserveDemoStartDate: true});

        return accessToken;
    }, [handleLogin, handleLogout, isDemoExpired, startDemoSignupTransition, t]);
    const logout = useCallback(() => handleLogout(ROUTE.LOGIN), [handleLogout]);

    return {refresh, logout};
}
