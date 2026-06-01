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
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const RedirectPage = () => {
    const [redirectError, setRedirectError] = useState<string | null>(null);
    const {
        actions: {handleLogin},
    } = useAuth();

    useEffect(() => {
        const query = qs.parse(location.search, {ignoreQueryPrefix: true});
        const accessToken = typeof query?.['accessToken'] === 'string' ? query['accessToken'] : undefined;
        const nextPageUrl = typeof query?.['nextPageUrl'] === 'string' ? resolveSafeRedirectTarget(query['nextPageUrl']) : undefined;
        const socialSignupProfile = getSocialSignupProfileFromQuery(query);
        const isSocialSignupRequired =
            getIsSocialSignupRequired(query) ||
            getIsSocialSignupPath(nextPageUrl ?? '') ||
            (nextPageUrl === ROUTE.ONBOARDING && socialSignupProfile !== null);

        saveSocialSignupProfile(socialSignupProfile ?? (isSocialSignupRequired ? {capturedAt: new Date().toISOString()} : null));

        if (accessToken) {
            if (!isWardAdminAccessToken(accessToken)) {
                setRedirectError('관리자 로그인 토큰을 받지 못했어요. 소셜 로그인 설정을 확인해 주세요.');

                return;
            }

            handleLogin(accessToken, isSocialSignupRequired ? buildSocialSignupRegisterPath() : nextPageUrl);
        }
    }, []);

    if (redirectError) {
        return <PageState tone="error" layout="screen" title="소셜 로그인에 실패했어요" description={redirectError} />;
    }

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            로그인중입니다.
            <LoadingSpinner size={56} />
        </div>
    );
};

export default RedirectPage;
