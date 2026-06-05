import {useEffect, useState} from 'react';
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
    const {pathname} = useLocation();
    const {t} = useTypedTranslation();
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
            navigate(ROUTE.LOGIN);
            return;
        }

        /**
         * /register에서 "병동 생성" 클릭 → /register-ward로 이동
         * AuthLayout effect가 다시 실행됨
         * accountMe.status는 WARD_SELECT_PENDING(LINKED도 DEMO도 아님)
         * pathname(/register-ward)이 허용 목록에 없음
         * → 즉시 /register로 되돌려짐
         * 온보딩/회원가입 관련 라우트는 아래 허용 목록에 둔다.
         */
        if (accountMe && accountMe.status !== 'LINKED' && accountMe.status !== 'DEMO') {
            if (![ROUTE.REGISTER, ROUTE.REGISTER_WARD, ROUTE.ENTER_WARD, ROUTE.ONBOARDING_WARD_CREATE].includes(pathname))
                navigate(ROUTE.REGISTER);
        }
    }, [_loaded, accessToken, accountMe, isAuth, navigate, pathname]);

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
        return <PageState tone="loading" layout="screen" title="로그인 상태를 확인하고 있어요" />;
    }

    if (!isAuth || !accessToken) {
        return null;
    }

    if (accountMeStatus === 'idle' || accountMeStatus === 'loading') {
        return <PageState tone="loading" layout="screen" title="로그인 상태를 확인하고 있어요" />;
    }

    if (accountMeStatus === 'error') {
        return (
            <div className="flex h-full w-full flex-col bg-main-bg">
                <PageState
                    tone="error"
                    layout="screen"
                    title="로그인 상태를 확인하지 못했어요"
                    description="세션이 만료되었거나 네트워크 연결이 불안정할 수 있어요."
                    action={{label: '다시 시도', onClick: () => void handleGetAccountMe().catch(() => undefined)}}
                >
                    <Button type="button" variant="outline" size="md" onClick={() => void handleLogout(ROUTE.LOGIN)}>
                        로그아웃
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
                        ? '체험이 끝났어요 | Dutying'
                        : demoSessionInfo?.isActive
                          ? t('feature.auth.demoSession.documentTitle', {countdown: demoSessionInfo.countdownLabel})
                          : '듀팅 | Dutying'
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
