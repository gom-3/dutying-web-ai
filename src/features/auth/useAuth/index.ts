import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import useLoadingUseCase from '@/features/ui/useLoading';
import useTutorialUseCase from '@/features/ui/useTutorial';
import useInitStore from '@/features/useInitStore';
import {AccountAPI, AuthAPI} from '@/shared/api';
import axiosInstance, {setAccessToken} from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';
import useAuthStore from './store';

const useAuth = (activeEffect = false) => {
    const {accountMe, isAuth, accessToken, nurseId, accountId, wardId, demoStartDate, _loaded, setState} = useAuthStore();
    const {pathname} = useLocation();
    const {setLoading} = useLoadingUseCase();
    const initStore = useInitStore();
    const {initTutorial} = useTutorialUseCase();
    const navigate = useNavigate();
    const handleLogout = async (fallBackPath?: string) => {
        initStore();
        sendEvent(events.auth.logut);

        if (fallBackPath && pathname !== fallBackPath) navigate(fallBackPath);
    };
    const handleLogin = (accessToken: string, nextPageUrl?: string | null) => {
        setState('isAuth', true);
        setState('accessToken', accessToken);
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        // refresh 등 "상태만 세팅"이 필요할 때는 리다이렉트를 하지 않는다.
        if (nextPageUrl === null) {
            sendEvent(events.auth.login);

            return;
        }

        if (nextPageUrl === 'back') {
            window.history.back();
        } else {
            location.replace(nextPageUrl ?? ROUTE.MAKE);
        }

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
        setState('demoStartDate', new Date().toISOString());
        navigate(ROUTE.MAKE);
        setLoading(false);
    };
    const handleGetAccountMe = async () => {
        const account = await AccountAPI.getAccountMe();

        setState('accountMe', account);
        setState('wardId', account.wardId);
        setState('accountId', account.accountId);
        setState('nurseId', account.nurseId);
        setState('isAuth', true);
    };

    useEffect(() => {
        if (accessToken) {
            setAccessToken(accessToken);
        }
    }, [accessToken]);

    useEffect(() => {
        if (_loaded && activeEffect) {
            if (demoStartDate && new Date(demoStartDate).getTime() + 3540000 - new Date().getTime() <= 0) handleLogout();
            else handleGetAccountMe();
        }
    }, [activeEffect, accessToken, _loaded]);

    return {
        state: {
            accountMe: accountMe === undefined ? null : accountMe,
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
