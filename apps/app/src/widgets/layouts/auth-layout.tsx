import {useEffect, useState} from 'react';
import {Helmet} from 'react-helmet';
import {Outlet, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {getDemoSessionInfo, isDemoSessionExpired} from '@/features/auth/model/demo-session';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import useInterval from '@/shared/util/useInterval';
import DemoSessionBanner from './demo-session-banner';

export const AuthLayout = () => {
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const navigate = useNavigate();
    const {pathname} = useLocation();
    const {t} = useTypedTranslation();
    const {
        state: {isAuth, accountMe, demoStartDate},
        actions: {handleLogout},
    } = useAuth();
    const demoSessionInfo = getDemoSessionInfo(demoStartDate, currentTime);
    const isDemoSessionExpiredNow = isDemoSessionExpired(demoStartDate, currentTime);
    const isDemoAccount = accountMe?.status === 'DEMO' || Boolean(demoStartDate);

    useEffect(() => {
        if (!isAuth) {
            navigate(ROUTE.LOGIN);
        }

        if (accountMe && accountMe.status !== 'LINKED' && accountMe.status !== 'DEMO') {
            if (![ROUTE.REGISTER, ROUTE.ONBOARDING_WARD_CREATE].includes(pathname)) navigate(ROUTE.REGISTER);
        }
    }, [accountMe, isAuth, navigate, pathname]);

    useEffect(() => {
        setCurrentTime(Date.now());
    }, [demoStartDate]);

    useEffect(() => {
        if (isDemoSessionExpiredNow) {
            void handleLogout();
        }
    }, [handleLogout, isDemoSessionExpiredNow]);

    useInterval(
        () => {
            const nextTime = Date.now();

            if (isDemoSessionExpired(demoStartDate, nextTime)) {
                void handleLogout();

                return;
            }

            setCurrentTime(nextTime);
        },
        demoStartDate ? 1000 : null,
    );

    return (
        isAuth && (
            <div className="flex h-full w-full flex-col">
                <Helmet
                    title={
                        demoSessionInfo?.isActive
                            ? t('feature.auth.demoSession.documentTitle', {countdown: demoSessionInfo.countdownLabel})
                            : '듀팅 | Dutying'
                    }
                />
                {isDemoAccount ? <DemoSessionBanner sessionInfo={demoSessionInfo} /> : null}
                <div className="min-h-0 flex-1">
                    <Outlet />
                </div>
            </div>
        )
    );
};
