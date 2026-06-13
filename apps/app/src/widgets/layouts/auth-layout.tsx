import {useEffect, useRef, useState} from 'react';
import {Helmet} from 'react-helmet';
import {Outlet, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {getDemoSessionInfo, isDemoSessionExpired} from '@/features/auth/model/demo-session';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';
import useInterval from '@/shared/util/useInterval';
import {DemoExpiredModal} from './demo-expired-modal';
import DemoSessionBanner from './demo-session-banner';

export const AuthLayout = () => {
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const navigate = useNavigate();
    const {pathname, search} = useLocation();
    const {t} = useTypedTranslation();
    const accountBootstrapTokenRef = useRef<string | null>(null);
    const {
        state: {isAuth, isDemoExpired, accountMe, accountMeStatus, accessToken, demoStartDate, _loaded},
        actions: {handleGetAccountMe, handleLogout, setDemoExpired, startDemoSignupTransition},
    } = useAuth();
    const demoSessionInfo = getDemoSessionInfo(demoStartDate, currentTime);
    const isDemoSessionExpiredNow = isDemoSessionExpired(demoStartDate, currentTime);
    const isDemoAccount = accountMe?.status === 'DEMO' || Boolean(demoStartDate);

    useEffect(() => {
        if (!_loaded) {
            return;
        }

        if (!isAuth || !accessToken) {
            navigate(`${ROUTE.LOGIN}?next=${encodeURIComponent(`${pathname}${search}`)}`, {replace: true});

            return;
        }

        /**
         * When "create ward" moves /register to /register-ward, this effect runs again.
         * WARD_SELECT_PENDING is neither LINKED nor DEMO, so keep onboarding/register routes
         * explicitly allowed here to avoid bouncing back to /register.
         */
        if (accountMe && accountMe.status !== 'LINKED' && accountMe.status !== 'DEMO') {
            if (![ROUTE.REGISTER, ROUTE.REGISTER_WARD, ROUTE.ENTER_WARD, ROUTE.ONBOARDING_WARD_CREATE].includes(pathname))
                navigate(ROUTE.REGISTER);
        }
    }, [_loaded, accessToken, accountMe, isAuth, navigate, pathname, search]);

    useEffect(() => {
        if (!_loaded || !isAuth || !accessToken) {
            accountBootstrapTokenRef.current = null;

            return;
        }

        if (accountMeStatus === 'success' || accountMeStatus === 'error') {
            accountBootstrapTokenRef.current = null;

            return;
        }

        if (accountBootstrapTokenRef.current === accessToken) {
            return;
        }

        accountBootstrapTokenRef.current = accessToken;
        void handleGetAccountMe().catch(() => undefined);
    }, [_loaded, accessToken, accountMeStatus, handleGetAccountMe, isAuth]);

    useEffect(() => {
        setCurrentTime(Date.now());
    }, [demoStartDate]);

    useEffect(() => {
        if (!demoStartDate) {
            if (isDemoExpired) {
                setDemoExpired(false);
            }

            return;
        }

        if (isDemoSessionExpiredNow !== isDemoExpired) {
            setDemoExpired(isDemoSessionExpiredNow);
        }
    }, [demoStartDate, isDemoExpired, isDemoSessionExpiredNow, setDemoExpired]);

    useInterval(
        () => {
            if (!demoStartDate) {
                return;
            }

            setCurrentTime(Date.now());
        },
        demoStartDate ? 1000 : null,
    );

    if (!_loaded || (isAuth && !accessToken)) {
        return <PageState tone="loading" layout="screen" title={t('feature.auth.state.loadingTitle')} />;
    }

    if (!isAuth || !accessToken) {
        return null;
    }

    if (accountMeStatus === 'idle' || accountMeStatus === 'loading') {
        return <PageState tone="loading" layout="screen" title={t('feature.auth.state.loadingTitle')} />;
    }

    if (accountMeStatus === 'error') {
        return (
            <div className="flex h-full w-full flex-col bg-main-bg">
                <PageState
                    tone="error"
                    layout="screen"
                    title={t('feature.auth.state.errorTitle')}
                    description={t('feature.auth.state.errorDescription')}
                    action={{label: t('feature.auth.state.retry'), onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                >
                    <Button type="button" variant="outline" size="md" onClick={() => void handleLogout(ROUTE.LOGIN)}>
                        {t('feature.auth.state.logout')}
                    </Button>
                </PageState>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col">
            <Helmet
                title={
                    isDemoExpired
                        ? t('feature.auth.demoSession.expiredDocumentTitle')
                        : demoSessionInfo?.isActive
                          ? t('feature.auth.demoSession.documentTitle', {countdown: demoSessionInfo.countdownLabel})
                          : t('feature.auth.documentTitle')
                }
            />
            <DemoExpiredModal
                open={isDemoExpired}
                onPrimaryAction={() => startDemoSignupTransition()}
                onSecondaryAction={() => void handleLogout(ROUTE.ROOT)}
            />
            {isDemoAccount && !isDemoExpired ? <DemoSessionBanner sessionInfo={demoSessionInfo} /> : null}
            <div className="min-h-0 flex-1">
                <Outlet />
            </div>
        </div>
    );
};
