import qs from 'qs';
import {useLayoutEffect, useRef, useState} from 'react';
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

const ACCESS_TOKEN_QUERY_KEYS = ['accessToken', 'access_token', 'token', 'adminAccessToken', 'jwt'];
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
const getHashQueryString = () => {
    const hash = location.hash.replace(/^#/, '');

    if (!hash) return '';

    if (hash.startsWith('?')) return hash.slice(1);

    const queryIndex = hash.indexOf('?');

    return queryIndex >= 0 ? hash.slice(queryIndex + 1) : hash;
};
const getRedirectQuery = () => {
    const hashQuery = qs.parse(getHashQueryString());
    const searchQuery = qs.parse(location.search, {ignoreQueryPrefix: true});

    return {
        ...hashQuery,
        ...searchQuery,
    };
};
const getRedirectAccessToken = (query: Record<string, unknown>) => getStringQueryValue(query, ACCESS_TOKEN_QUERY_KEYS);
const RedirectPage = () => {
    const {t} = useTypedTranslation();
    const [redirectError, setRedirectError] = useState<string | null>(null);
    const hasHandledRedirectRef = useRef(false);
    const {
        state: {_loaded},
        actions: {handleLogin},
    } = useAuth();
    const renderQuery = getRedirectQuery();
    const renderAccessToken = getRedirectAccessToken(renderQuery);
    const hasLoginToken = Boolean(renderAccessToken);

    useLayoutEffect(() => {
        if (hasHandledRedirectRef.current) {
            return;
        }

        const query = getRedirectQuery();
        const accessToken = getRedirectAccessToken(query);

        if (!accessToken) {
            hasHandledRedirectRef.current = true;
            setRedirectError(t('page.login.redirect.adminTokenMissing'));

            return;
        }

        if (!_loaded) {
            return;
        }

        const nextPageUrlValue = getStringQueryValue(query, ['nextPageUrl', 'next', 'redirect']);
        const resolvedNextPageUrl = nextPageUrlValue ? resolveSafeRedirectTarget(nextPageUrlValue) : undefined;
        const nextPageUrl = resolvedNextPageUrl === ROUTE.ONBOARDING ? ROUTE.REGISTER : resolvedNextPageUrl;
        const socialSignupProfile = getSocialSignupProfileFromQuery(query);
        const isSocialSignupRequired =
            getIsSocialSignupRequired(query) ||
            getIsSocialSignupPath(nextPageUrl ?? '') ||
            (resolvedNextPageUrl === ROUTE.ONBOARDING && socialSignupProfile !== null);

        saveSocialSignupProfile(socialSignupProfile ?? (isSocialSignupRequired ? {capturedAt: new Date().toISOString()} : null));

        hasHandledRedirectRef.current = true;

        if (!isWardAdminAccessToken(accessToken)) {
            setRedirectError(t('page.login.redirect.adminTokenMissing'));

            return;
        }

        handleLogin(accessToken, isSocialSignupRequired ? buildSocialSignupRegisterPath() : nextPageUrl);
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
