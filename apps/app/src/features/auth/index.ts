import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import type {TAccount} from '@/entities/account';
import useLoadingUseCase from '@/features/loading';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import useTutorialUseCase from '@/features/tutorial';
import {AdminAPI, AuthAPI} from '@/shared/api';
import {setAccessToken, setAdminAccessToken} from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';
import {toAccountCompatibleAdminMe} from './model/admin-account';
import {isWardAdminAccessToken} from './model/admin-token';
import {buildDemoSignupLoginPath, isDemoSessionExpired} from './model/demo-session';
import {createDevAuthBypassAccount, DEV_AUTH_BYPASS_TOKEN, isDevAuthBypassAvailable} from './model/dev-auth-bypass';
import {executeLoginRedirect, getLoginRedirectDecision} from './model/login-redirect';
import useAuthStore from './model/store';

type THandleLoginOptions = {
    preserveDemoStartDate?: boolean;
};

const useAuth = (activeEffect = false) => {
    const {
        accountMe,
        accountMeStatus,
        isAuth,
        isDemoExpired,
        accessToken,
        nurseId,
        accountId,
        wardId,
        demoStartDate,
        _loaded,
        beginLogin,
        applyDemoSession,
        setAccountMeLoading,
        setAccountMeSuccess,
        setAccountMeError,
        setDemoExpired: setAuthDemoExpired,
        resetState,
    } = useAuthStore();
    const resetRequestShiftState = useRequestShiftStore((state) => state.resetState);
    const {pathname} = useLocation();
    const {setLoading} = useLoadingUseCase();
    const {initTutorial} = useTutorialUseCase();
    const navigate = useNavigate();
    const resetSessionState = () => {
        resetRequestShiftState();
        resetState();
        setAccessToken('');
        setAdminAccessToken('');
    };
    const syncAccessTokenHeaders = (token: string) => {
        setAccessToken(token);
        setAdminAccessToken(isWardAdminAccessToken(token) ? token : '');
    };
    const handleLogout = async (fallBackPath?: string) => {
        resetSessionState();
        sendEvent(events.auth.logut);

        if (fallBackPath && pathname !== fallBackPath) navigate(fallBackPath);
    };
    const handleLogin = (accessToken: string, nextPageUrl?: string | null, options?: THandleLoginOptions) => {
        beginLogin(accessToken, {preserveDemoStartDate: options?.preserveDemoStartDate});
        syncAccessTokenHeaders(accessToken);

        const redirectDecision = getLoginRedirectDecision(nextPageUrl);

        executeLoginRedirect(redirectDecision);

        sendEvent(events.auth.login);
    };
    const handleDevSignupBypass = () => {
        if (!isDevAuthBypassAvailable()) return;

        beginLogin(DEV_AUTH_BYPASS_TOKEN);
        syncAccessTokenHeaders(DEV_AUTH_BYPASS_TOKEN);
        setAccountMeSuccess(createDevAuthBypassAccount());
        navigate(ROUTE.REGISTER);
    };
    const setDemoExpired = (expired: boolean) => {
        setAuthDemoExpired(expired);
    };
    const startDemoSignupTransition = (nextPath: string = ROUTE.REGISTER) => {
        void handleLogout(buildDemoSignupLoginPath(nextPath));
    };
    const demoTry = async () => {
        setLoading(true);

        try {
            initTutorial();

            const data = await AuthAPI.demoStart();

            applyDemoSession({
                accessToken: data.accessToken,
                accountId: data.accountResDto.accountId,
                nurseId: data.accountResDto.nurseId,
                wardId: data.accountResDto.wardId,
                demoStartDate: new Date().toISOString(),
            });

            syncAccessTokenHeaders(data.accessToken);
            navigate(ROUTE.MAKE);
        } finally {
            setLoading(false);
        }
    };
    const handleGetAccountMe = async () => {
        setAccountMeLoading();

        try {
            const account = toAccountCompatibleAdminMe(await AdminAPI.getMe());

            setAccountMeSuccess(account as TAccount);
        } catch (error) {
            setAccountMeError();
            throw error;
        }
    };

    useEffect(() => {
        if (accessToken) {
            syncAccessTokenHeaders(accessToken);
        } else {
            setAccessToken('');
            setAdminAccessToken('');
        }
    }, [accessToken]);

    useEffect(() => {
        if (_loaded && activeEffect && accessToken) {
            setDemoExpired(isDemoSessionExpired(demoStartDate));
            void handleGetAccountMe().catch(() => undefined);
        }

        if (_loaded && activeEffect && !accessToken) {
            setDemoExpired(false);
        }
    }, [accessToken, activeEffect, demoStartDate, _loaded]);

    return {
        state: {
            accountMe: accountMe === undefined ? null : accountMe,
            accountMeStatus,
            isAuth,
            isDemoExpired,
            accessToken,
            nurseId,
            accountId,
            wardId,
            demoStartDate,
            _loaded,
        },
        actions: {
            handleGetAccountMe,
            applyAccountMe: setAccountMeSuccess,
            handleDevSignupBypass,
            handleLogin,
            handleLogout,
            setDemoExpired,
            startDemoSignupTransition,
            demoTry,
        },
    };
};

export default useAuth;
