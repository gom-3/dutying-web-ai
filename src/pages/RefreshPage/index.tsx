import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import useRefresh from '@/features/auth/useRefresh';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';

function RefreshPage() {
    const {refresh} = useRefresh();
    const {search} = useLocation();
    const {t} = useTypedTranslation();
    const rawNext = new URLSearchParams(search).get('next');
    const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await refresh();

                if (cancelled) return;

                location.replace(next ?? ROUTE.MAKE);
            } catch {
                if (cancelled) return;

                location.replace(ROUTE.ROOT);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [refresh, next]);

    return <PageState tone="loading" layout="screen" title={t('page.refresh.loading')} description={t('page.state.loadingDescription')} />;
}

export default RefreshPage;
