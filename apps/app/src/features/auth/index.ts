import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {events, sendEvent} from '@/analytics';
import type {TAccount} from '@/entities/account';
import useLoadingUseCase from '@/features/loading';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import useTutorialUseCase from '@/features/tutorial';
import i18n from '@/i18n';
import {AdminAPI, AuthAPI} from '@/shared/api';
import {setAccessToken, setAdminAccessToken} from '@/shared/api/client';
import ROUTE from '@/shared/constant/path';
import {normalizePreferredLanguage, normalizeServiceRegion, setStoredServiceRegion} from '@/shared/i18n/locale';
import {withTimeout} from '@/shared/util/with-timeout';
import {toAccountCompatibleAdminMe} from './model/admin-account';
import {isWardAdminAccessToken} from './model/admin-token';
import {buildDemoSignupLoginPath, isDemoSessionExpired} from './model/demo-session';
import {executeLoginRedirect, getLoginRedirectDecision} from './model/login-redirect';
import useAuthStore from './model/store';

type THandleLoginOptions = {
    preserveDemoStartDate?: boolean;
};

const ACCOUNT_BOOTSTRAP_TIMEOUT_MS = 15000;
const LANGUAGE_QUERY_PARAM = 'lng';

let accountMeRequest: {id: number; accessToken: string | null; promise: Promise<void>} | null = null;
let accountMeRequestId = 0;

const canceledAccountMeRequestIds = new Set<number>();
const clearAccountMeRequest = () => {
    if (accountMeRequest) {
        canceledAccountMeRequestIds.add(accountMeRequest.id);
    }

    accountMeRequest = null;
};
const getExplicitLanguageFromQuery = () => {
    if (typeof window === 'undefined') return undefined;

    return normalizePreferredLanguage(new URLSearchParams(window.location.search).get(LANGUAGE_QUERY_PARAM));
};
const syncAccountLocalePreferences = (account: TAccount) => {
    const nextServiceRegion = normalizeServiceRegion(account.serviceRegion) ?? normalizeServiceRegion(account.resolvedRegion);

    if (nextServiceRegion) {
        setStoredServiceRegion(nextServiceRegion);
    }

    if (getExplicitLanguageFromQuery()) return;

    const nextLanguage = normalizePreferredLanguage(account.preferredLanguage) ?? normalizePreferredLanguage(account.resolvedLanguage);

    if (!nextLanguage) return;

    const currentLanguage = normalizePreferredLanguage(i18n.resolvedLanguage ?? i18n.language);

    if (currentLanguage !== nextLanguage) {
        void i18n.changeLanguage(nextLanguage);
    }
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
        clearAccountMeRequest();
        resetRequestShiftState();
        resetState();
        setAccessToken('');
        setAdminAccessToken('');
    };
    const syncAccessTokenHeaders = (token: string) => {
        setAccessToken(token);
        setAdminAccessToken(isWardAdminAccessToken(token) ? token : '');
    };
    const applyAccountMe = (account: TAccount) => {
        syncAccountLocalePreferences(account);
        setAccountMeSuccess(account);
    };
    const handleLogout = async (fallBackPath?: string) => {
        const logoutAccessToken = useAuthStore.getState().accessToken;

        resetSessionState();
        sendEvent(events.auth.logut);

        if (fallBackPath && pathname !== fallBackPath) navigate(fallBackPath);

        try {
            await AuthAPI.logout(logoutAccessToken);
        } catch {
            // Local logout should still succeed even if the server-side revocation request fails.
        }
    };
    const handleLogin = (accessToken: string, nextPageUrl?: string | null, options?: THandleLoginOptions) => {
        clearAccountMeRequest();
        setLoading(false);
        beginLogin(accessToken, {preserveDemoStartDate: options?.preserveDemoStartDate});
        syncAccessTokenHeaders(accessToken);

        const redirectDecision = getLoginRedirectDecision(nextPageUrl);

        executeLoginRedirect(redirectDecision);

        sendEvent(events.auth.login);
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
            navigate(ROUTE.HOME);
        } finally {
            setLoading(false);
        }
    };
    const handleGetAccountMe = async () => {
        const requestAccessToken = useAuthStore.getState().accessToken;

        if (accountMeRequest?.accessToken === requestAccessToken) {
            return accountMeRequest.promise;
        }

        const requestId = ++accountMeRequestId;

        let resolveRequest: () => void = () => undefined;
        let rejectRequest: (error: unknown) => void = () => undefined;

        const requestPromise = new Promise<void>((resolve, reject) => {
            resolveRequest = resolve;
            rejectRequest = reject;
        });

        accountMeRequest = {id: requestId, accessToken: requestAccessToken, promise: requestPromise};

        void (async () => {
            setAccountMeLoading();

            try {
                const account = toAccountCompatibleAdminMe(
                    await withTimeout(AdminAPI.getMe(), ACCOUNT_BOOTSTRAP_TIMEOUT_MS, 'account_bootstrap_timeout'),
                );

                if (canceledAccountMeRequestIds.has(requestId) || useAuthStore.getState().accessToken !== requestAccessToken) {
                    resolveRequest();

                    return;
                }

                applyAccountMe(account as TAccount);
                resolveRequest();
            } catch (error) {
                if (!canceledAccountMeRequestIds.has(requestId)) {
                    setAccountMeError();
                }

                rejectRequest(error);
            } finally {
                if (accountMeRequest?.id === requestId) {
                    accountMeRequest = null;
                }

                canceledAccountMeRequestIds.delete(requestId);
            }
        })();

        return requestPromise;
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
            applyAccountMe,
            handleLogin,
            handleLogout,
            setDemoExpired,
            startDemoSignupTransition,
            demoTry,
        },
    };
};

export default useAuth;
