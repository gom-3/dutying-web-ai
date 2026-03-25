import {useEffect, useState} from 'react';
import {Helmet} from 'react-helmet';
import {Outlet, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {formatDemoSessionRemainingLabel, getDemoSessionRemainingMs} from '@/features/auth/model/demo-session';
import ROUTE from '@/shared/constant/path';
import useInterval from '@/shared/util/useInterval';
import {DemoExpiredModal} from './demo-expired-modal';

export const AuthLayout = () => {
    const [demoRemainTime, setDemoRemainTime] = useState<string | null>(null);
    const navigate = useNavigate();
    const {pathname} = useLocation();
    const {
        state: {isAuth, isDemoExpired, accountMe, demoStartDate},
        actions: {handleLogout, setDemoExpired, startDemoSignupTransition},
    } = useAuth();

    useEffect(() => {
        if (!isAuth) {
            navigate(ROUTE.LOGIN);
        }

        if (accountMe && accountMe.status !== 'LINKED' && accountMe.status !== 'DEMO') {
            if (![ROUTE.REGISTER, ROUTE.ONBOARDING_WARD_CREATE].includes(pathname)) navigate(ROUTE.REGISTER);
        }
    }, [accountMe, isAuth, navigate, pathname]);

    useInterval(
        () => {
            if (!demoStartDate) {
                setDemoRemainTime(null);

                if (isDemoExpired) {
                    setDemoExpired(false);
                }

                return;
            }

            const remainingMs = getDemoSessionRemainingMs(demoStartDate);

            if (remainingMs > 0) {
                setDemoRemainTime(formatDemoSessionRemainingLabel(demoStartDate));

                if (isDemoExpired) {
                    setDemoExpired(false);
                }

                return;
            }

            setDemoRemainTime(null);

            if (!isDemoExpired) {
                setDemoExpired(true);
            }
        },
        demoStartDate ? 1000 : null,
    );

    return (
        isAuth && (
            <div className="h-full w-full">
                <Helmet title={isDemoExpired ? '체험이 종료되었어요 | Dutying' : (demoRemainTime ?? '듀팅 | Dutying')} />
                <DemoExpiredModal
                    open={isDemoExpired}
                    onPrimaryAction={() => startDemoSignupTransition()}
                    onSecondaryAction={() => void handleLogout(ROUTE.ROOT)}
                />
                <Outlet />
            </div>
        )
    );
};
