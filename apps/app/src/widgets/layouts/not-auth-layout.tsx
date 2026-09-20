import {useEffect} from 'react';
import {Helmet} from 'react-helmet';
import {Outlet, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {sanitizeInternalPath} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export const NotAuthLayout = () => {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const {search} = useLocation();
    const {
        state: {isAuth, _loaded},
    } = useAuth();
    const nextPath = sanitizeInternalPath(new URLSearchParams(search).get('next'), ROUTE.HOME);

    useEffect(() => {
        if (_loaded && isAuth) navigate(nextPath, {replace: true});
    }, [_loaded, isAuth, navigate, nextPath]);

    return _loaded && !isAuth ? (
        <>
            <Helmet title={t('feature.auth.documentTitle')} />
            <Outlet />
        </>
    ) : null;
};
