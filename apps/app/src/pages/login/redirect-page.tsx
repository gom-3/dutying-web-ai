import {useLayoutEffect, useRef, useState} from 'react';
import useAuth from '@/features/auth';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {
    ACCESS_TOKEN_QUERY_KEYS,
    clearStoredOAuthRedirectPayload,
    getOAuthRedirectQuery,
} from '@/features/auth/model/oauth-redirect-payload';
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

const normalizeQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return normalizeQueryValue(value[0]);
    }

    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};
const getStringQueryValue = (query: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
        const value = normalizeQueryValue(query[key]);

        if (value) return value;
    }

    return undefined;
};
const getRedirectAccessToken = (query: Record<string, unknown>) => getStringQueryValue(query, ACCESS_TOKEN_QUERY_KEYS);
const getRedirectTarget = (query: Record<string, unknown>) => {
    const nextPageUrlValue = getStringQueryValue(query, ['nextPageUrl', 'next', 'redirect']);
    const resolvedNextPageUrl = nextPageUrlValue ? resolveSafeRedirectTarget(nextPageUrlValue) : undefined;
    const nextPageUrl = resolvedNextPageUrl === ROUTE.ONBOARDING ? ROUTE.REGISTER : resolvedNextPageUrl;
    const socialSignupProfile = getSocialSignupProfileFromQuery(query);
    const isSocialSignupRequired =
        getIsSocialSignupRequired(query) ||
        getIsSocialSignupPath(nextPageUrl ?? '') ||
        (resolvedNextPageUrl === ROUTE.ONBOARDING && socialSignupProfile !== null);

    return {
        hasNextPageUrl: Boolean(nextPageUrlValue),
        nextPageUrl,
        socialSignupProfile,
        isSocialSignupRequired,
    };
};
const buildRedirectNextPageUrl = (nextPageUrl: string | undefined, isSocialSignupRequired: boolean) =>
    isSocialSignupRequired ? buildSocialSignupRegisterPath() : nextPageUrl;
const buildRefreshRedirectPath = (nextPageUrl: string) => `${ROUTE.REFRESH}?next=${encodeURIComponent(nextPageUrl)}`;
const RedirectPage = () => {
    const {t} = useTypedTranslation();
    const [redirectError, setRedirectError] = useState<string | null>(null);
    const hasHandledRedirectRef = useRef(false);
    const {
        state: {_loaded},
        actions: {handleLogin},
    } = useAuth();
    const renderQuery = getOAuthRedirectQuery();
    const renderAccessToken = getRedirectAccessToken(renderQuery);
    const hasLoginToken = Boolean(renderAccessToken);

    useLayoutEffect(() => {
        if (hasHandledRedirectRef.current) {
            return;
        }

        const query = getOAuthRedirectQuery();
        const accessToken = getRedirectAccessToken(query);
        const {hasNextPageUrl, nextPageUrl, socialSignupProfile, isSocialSignupRequired} = getRedirectTarget(query);
        const redirectNextPageUrl = buildRedirectNextPageUrl(nextPageUrl, isSocialSignupRequired);

        if (!accessToken) {
            if (redirectNextPageUrl || hasNextPageUrl) {
                saveSocialSignupProfile(socialSignupProfile ?? (isSocialSignupRequired ? {capturedAt: new Date().toISOString()} : null));
                hasHandledRedirectRef.current = true;
                clearStoredOAuthRedirectPayload();
                location.replace(buildRefreshRedirectPath(redirectNextPageUrl ?? ROUTE.HOME));

                return;
            }

            hasHandledRedirectRef.current = true;
            clearStoredOAuthRedirectPayload();
            setRedirectError(t('page.login.redirect.adminTokenMissing'));

            return;
        }

        if (!_loaded) {
            return;
        }

        saveSocialSignupProfile(socialSignupProfile ?? (isSocialSignupRequired ? {capturedAt: new Date().toISOString()} : null));

        hasHandledRedirectRef.current = true;

        if (!isWardAdminAccessToken(accessToken)) {
            clearStoredOAuthRedirectPayload();
            setRedirectError(t('page.login.redirect.adminTokenMissing'));

            return;
        }

        clearStoredOAuthRedirectPayload();
        handleLogin(accessToken, redirectNextPageUrl);
    }, [_loaded, handleLogin, t]);

    if (redirectError) {
        return <PageState tone="error" layout="screen" title={t('page.login.redirect.errorTitle')} description={redirectError} />;
    }

    if (hasLoginToken) {
        return null;
    }

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            {t('page.login.redirect.loading')}
            <LoadingSpinner size={56} />
        </div>
    );
};

export default RedirectPage;
