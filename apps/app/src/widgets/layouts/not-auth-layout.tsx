import {useEffect} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {sanitizeInternalPath} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';

export const NotAuthLayout = () => {
    const navigate = useNavigate();
    const {search} = useLocation();
    const {
        state: {isAuth, _loaded},
    } = useAuth();
    const nextPath = sanitizeInternalPath(new URLSearchParams(search).get('next'), ROUTE.MAKE);

    useEffect(() => {
        if (_loaded && isAuth) navigate(nextPath, {replace: true});
    }, [_loaded, isAuth, navigate, nextPath]);

    return _loaded && !isAuth ? <Outlet /> : null;
};
