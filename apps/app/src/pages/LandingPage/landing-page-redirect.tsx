import {useEffect} from 'react';
import ROUTE from '@/shared/constant/path';

const LandingPageRedirect = () => {
    useEffect(() => {
        window.location.replace(ROUTE.LOGIN);
    }, []);

    return null;
};

export default LandingPageRedirect;
