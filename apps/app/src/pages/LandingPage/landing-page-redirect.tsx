import {useEffect} from 'react';
import useAuth from '@/features/auth/useAuth';
import ROUTE from '@/shared/constant/path';

export const getLandingRedirectPath = (isAuth: boolean) => (isAuth ? ROUTE.MAKE : ROUTE.LOGIN);

const LandingPageRedirect = () => {
    const {
        state: {isAuth},
    } = useAuth();

    useEffect(() => {
        window.location.replace(getLandingRedirectPath(isAuth));
    }, [isAuth]);

    return null;
};

export default LandingPageRedirect;
