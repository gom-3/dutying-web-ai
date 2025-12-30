import {useEffect} from 'react';
import {TailSpin} from 'react-loader-spinner';
import {useLocation} from 'react-router-dom';
import useRefresh from '@/features/auth/useRefresh';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

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

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            {t('page.refresh.loading')}
            <TailSpin color="#844AFF" />
        </div>
    );
}

export default RefreshPage;
