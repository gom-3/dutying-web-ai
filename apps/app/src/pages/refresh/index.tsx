import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import useRefresh, {REFRESH_DEMO_EXPIRED_REDIRECT_ERROR, REFRESH_UNAVAILABLE_ERROR} from '@/features/refresh';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';
import PageState from '@/shared/ui/PageState';

function RefreshPage() {
    const {refresh, logout} = useRefresh();
    const {pathname, search} = useLocation();
    const {t} = useTypedTranslation();
    const rawNext = new URLSearchParams(search).get('next');
    const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined;
    const [retryCount, setRetryCount] = useState(0);
    const [isUnavailable, setIsUnavailable] = useState(false);
    const attemptedRefreshKeyRef = useRef<string | null>(null);
    const refreshAttemptIdRef = useRef(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const nextPath = next ?? ROUTE.HOME;
        const refreshKey = `${nextPath}#${retryCount}`;

        if (attemptedRefreshKeyRef.current === refreshKey) {
            return;
        }

        attemptedRefreshKeyRef.current = refreshKey;
        refreshAttemptIdRef.current += 1;

        const attemptId = refreshAttemptIdRef.current;
        const shouldApplyAttemptResult = () =>
            isMountedRef.current && refreshAttemptIdRef.current === attemptId && pathname === ROUTE.REFRESH;

        setIsUnavailable(false);

        (async () => {
            try {
                await refresh();

                if (!shouldApplyAttemptResult()) return;

                location.replace(nextPath);
            } catch (error) {
                if (!shouldApplyAttemptResult()) return;

                if (error instanceof Error && error.message === REFRESH_DEMO_EXPIRED_REDIRECT_ERROR) {
                    return;
                }

                if (error instanceof Error && error.message === REFRESH_UNAVAILABLE_ERROR) {
                    // The API was unreachable; the session is intact, so let the user retry instead of bouncing to landing.
                    setIsUnavailable(true);

                    return;
                }

                location.replace(ROUTE.ROOT);
            }
        })();
    }, [pathname, refresh, next, retryCount]);

    if (isUnavailable) {
        return (
            <div className="flex h-full w-full flex-col bg-main-bg">
                <PageState
                    tone="error"
                    layout="screen"
                    title={t('feature.auth.state.errorTitle')}
                    description={t('feature.auth.state.errorDescription')}
                    action={{label: t('feature.auth.state.retry'), onClick: () => setRetryCount((count) => count + 1)}}
                >
                    <Button type="button" variant="outline" size="md" onClick={() => void logout()}>
                        {t('feature.auth.state.logout')}
                    </Button>
                </PageState>
            </div>
        );
    }

    return <PageState tone="loading" layout="screen" title={t('page.refresh.loading')} description={t('page.state.loadingDescription')} />;
}

export default RefreshPage;
