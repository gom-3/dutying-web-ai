import qs from 'qs';
import {useEffect, useState} from 'react';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {
    buildSocialSignupRegisterPath,
    getIsSocialSignupPath,
    getIsSocialSignupRequired,
    getSocialSignupProfileFromQuery,
    saveSocialSignupProfile,
} from '@/features/auth/model/social-signup';
import {resolveSafeRedirectTarget} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const RedirectPage = () => {
    const {t} = useTypedTranslation();
    const [redirectError, setRedirectError] = useState<string | null>(null);
    const {
        actions: {handleLogin},
    } = useAuth();

    useEffect(() => {
        const query = qs.parse(location.search, {ignoreQueryPrefix: true});
        const accessToken = typeof query?.['accessToken'] === 'string' ? query['accessToken'] : undefined;
        const resolvedNextPageUrl = typeof query?.['nextPageUrl'] === 'string' ? resolveSafeRedirectTarget(query['nextPageUrl']) : undefined;
        const nextPageUrl = resolvedNextPageUrl === ROUTE.ONBOARDING ? ROUTE.REGISTER : resolvedNextPageUrl;
        const socialSignupProfile = getSocialSignupProfileFromQuery(query);
        const isSocialSignupRequired =
            getIsSocialSignupRequired(query) ||
            getIsSocialSignupPath(nextPageUrl ?? '') ||
            (resolvedNextPageUrl === ROUTE.ONBOARDING && socialSignupProfile !== null);

        saveSocialSignupProfile(socialSignupProfile ?? (isSocialSignupRequired ? {capturedAt: new Date().toISOString()} : null));

        if (accessToken) {
            if (!isWardAdminAccessToken(accessToken)) {
                setRedirectError(t('page.login.redirect.adminTokenMissing'));

                return;
            }

            handleLogin(accessToken, isSocialSignupRequired ? buildSocialSignupRegisterPath() : nextPageUrl);
        }
    }, []);

    if (redirectError) {
        return <PageState tone="error" layout="screen" title={t('page.login.redirect.errorTitle')} description={redirectError} />;
    }

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            {t('page.login.redirect.loading')}
            <LoadingSpinner size={56} />
        </div>
    );
};

export default RedirectPage;
