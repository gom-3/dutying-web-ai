import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import useLoadingUseCase from '@/features/loading';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import useTutorialUseCase from '@/features/tutorial';
import {AccountAPI, AuthAPI} from '@/shared/api';
import {setAccessToken} from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';
import {executeLoginRedirect, getLoginRedirectDecision} from './model/login-redirect';
import useAuthStore from './model/store';

type THandleLoginOptions = {
    preserveDemoStartDate?: boolean;
};

const useAuth = (activeEffect = false) => {
    const {accountMe, accountMeStatus, isAuth, accessToken, nurseId, accountId, wardId, demoStartDate, _loaded, setState, resetState} =
        useAuthStore();
    const resetRequestShiftState = useRequestShiftStore((state) => state.resetState);
    const {pathname} = useLocation();
    const {setLoading} = useLoadingUseCase();
    const {initTutorial} = useTutorialUseCase();
    const navigate = useNavigate();
    const resetSessionState = () => {
        resetRequestShiftState();
        resetState();
        setAccessToken('');
    };
    const handleLogout = async (fallBackPath?: string) => {
        resetSessionState();
        sendEvent(events.auth.logut);

        if (fallBackPath && pathname !== fallBackPath) navigate(fallBackPath);
    };
    const handleLogin = (accessToken: string, nextPageUrl?: string | null, options?: THandleLoginOptions) => {
        setState('accountMe', null);
        setState('accountId', null);
        setState('nurseId', null);
        setState('wardId', null);

        if (!options?.preserveDemoStartDate) {
            setState('demoStartDate', null);
        }

        setState('isAuth', true);
        setState('accessToken', accessToken);
        setState('accountMeStatus', 'loading');
        setAccessToken(accessToken);

        const redirectDecision = getLoginRedirectDecision(nextPageUrl);

        executeLoginRedirect(redirectDecision);

        sendEvent(events.auth.login);
    };
    const demoTry = async () => {
        setLoading(true);
        initTutorial();

        const data = await AuthAPI.demoStart();

        setState('accessToken', data.accessToken);
        setState('accountId', data.accountResDto.accountId);
        setState('nurseId', data.accountResDto.nurseId);
        setState('wardId', data.accountResDto.wardId);
        setState('isAuth', true);
        setState('accountMeStatus', 'success');
        setState('demoStartDate', new Date().toISOString());
        navigate(ROUTE.MAKE);
        setLoading(false);
    };
    const handleGetAccountMe = async () => {
        setState('accountMeStatus', 'loading');

        try {
            const account = await AccountAPI.getAccountMe();

            setState('accountMe', account);
            setState('wardId', account.wardId);
            setState('accountId', account.accountId);
            setState('nurseId', account.nurseId);
            setState('isAuth', true);
            setState('accountMeStatus', 'success');
        } catch (error) {
            setState('accountMeStatus', 'error');
            throw error;
        }
    };

    useEffect(() => {
        if (accessToken) {
            setAccessToken(accessToken);
        }
    }, [accessToken]);

    useEffect(() => {
        if (_loaded && activeEffect && accessToken) {
            if (demoStartDate && new Date(demoStartDate).getTime() + 3540000 - new Date().getTime() <= 0) {
                void handleLogout();
            } else {
                void handleGetAccountMe().catch(() => undefined);
            }
        }
    }, [accessToken, activeEffect, demoStartDate, _loaded]);

    return {
        state: {
            accountMe: accountMe === undefined ? null : accountMe,
            accountMeStatus,
            isAuth,
            accessToken,
            nurseId,
            accountId,
            wardId,
            demoStartDate,
            _loaded,
        },
        actions: {
            handleGetAccountMe,
            handleLogin,
            handleLogout,
            demoTry,
        },
    };
};

export default useAuth;
