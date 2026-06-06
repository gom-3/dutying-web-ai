import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router-dom';
import useRefresh, {REFRESH_DEMO_EXPIRED_REDIRECT_ERROR} from '@/features/refresh';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';

function RefreshPage() {
    const {refresh} = useRefresh();
    const {pathname, search} = useLocation();
    const {t} = useTypedTranslation();
    const rawNext = new URLSearchParams(search).get('next');
    const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined;
    const attemptedRefreshKeyRef = useRef<string | null>(null);
    const refreshAttemptIdRef = useRef(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const refreshKey = next ?? ROUTE.MAKE;

        if (attemptedRefreshKeyRef.current === refreshKey) {
            return;
        }

        attemptedRefreshKeyRef.current = refreshKey;
        refreshAttemptIdRef.current += 1;

        const attemptId = refreshAttemptIdRef.current;
        const shouldApplyAttemptResult = () =>
            isMountedRef.current && refreshAttemptIdRef.current === attemptId && pathname === ROUTE.REFRESH;

        (async () => {
            try {
                await refresh();

                if (!shouldApplyAttemptResult()) return;

                location.replace(refreshKey);
            } catch (error) {
                if (!shouldApplyAttemptResult()) return;

                if (error instanceof Error && error.message === REFRESH_DEMO_EXPIRED_REDIRECT_ERROR) {
                    return;
                }

                location.replace(ROUTE.ROOT);
            }
        })();
    }, [pathname, refresh, next]);

    return <PageState tone="loading" layout="screen" title={t('page.refresh.loading')} description={t('page.state.loadingDescription')} />;
}

export default RefreshPage;
