import qs from 'qs';
import {useEffect} from 'react';
import useAuth from '@/features/auth';
import {getIsSocialSignupRequired, getSocialSignupProfileFromQuery, saveSocialSignupProfile} from '@/features/auth/model/social-signup';
import {resolveSafeRedirectTarget} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';

const RedirectPage = () => {
    const {
        actions: {handleLogin},
    } = useAuth();

    useEffect(() => {
        const query = qs.parse(location.search, {ignoreQueryPrefix: true});
        const accessToken = typeof query?.['accessToken'] === 'string' ? query['accessToken'] : undefined;
        const nextPageUrl = typeof query?.['nextPageUrl'] === 'string' ? resolveSafeRedirectTarget(query['nextPageUrl']) : undefined;
        const isSocialSignupRequired = getIsSocialSignupRequired(query);
        const socialSignupProfile = getSocialSignupProfileFromQuery(query);

        saveSocialSignupProfile(socialSignupProfile);

        if (accessToken) {
            handleLogin(accessToken, isSocialSignupRequired ? ROUTE.ONBOARDING : nextPageUrl);
        }
    }, []);

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            로그인중입니다.
            <LoadingSpinner size={56} />
        </div>
    );
};

export default RedirectPage;
