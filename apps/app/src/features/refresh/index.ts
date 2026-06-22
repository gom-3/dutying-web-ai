import {useCallback} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import axiosInstance from '@/shared/api/client';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {withTimeout} from '@/shared/util/with-timeout';

export const REFRESH_DEMO_EXPIRED_REDIRECT_ERROR = 'refresh_demo_expired_redirect';

const REFRESH_TIMEOUT_MS = 15000;
const SESSION_EXPIRED_TOAST_ID = 'auth-session-expired';

export default function useRefresh() {
    const {
        state: {isDemoExpired},
        actions: {handleLogout, handleLogin, startDemoSignupTransition},
    } = useAuth();
    const {t} = useTypedTranslation();
    const refresh = useCallback(async () => {
        try {
            axiosInstance.defaults.headers.common['Authorization'] = undefined;

            const refreshResponse = await withTimeout(
                axiosInstance.post('/auth/admin/token/refresh'),
                REFRESH_TIMEOUT_MS,
                'refresh_timeout',
            );
            const accessToken = refreshResponse.data.accessToken;

            // 여기서는 "세션만 갱신"하고, 이동은 호출자(RefreshPage)가 담당한다.
            handleLogin(accessToken, null, {preserveDemoStartDate: true});

            return accessToken as string;
        } catch {
            if (isDemoExpired) {
                startDemoSignupTransition();
                throw new Error(REFRESH_DEMO_EXPIRED_REDIRECT_ERROR);
            }

            toast.error(t('feature.auth.sessionExpired'), {id: SESSION_EXPIRED_TOAST_ID});
            await handleLogout();
            throw new Error('refresh_failed');
        }
    }, [handleLogin, handleLogout, isDemoExpired, startDemoSignupTransition, t]);

    return {refresh};
}
