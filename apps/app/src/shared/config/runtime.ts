import ROUTE from '@/shared/constant/path';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const getWindowOrigin = () => {
    if (typeof window === 'undefined') return undefined;

    return window.location.origin;
};
const getRuntimeUrl = (envValue: string | undefined, fallback: string) => {
    const normalized = envValue?.trim();

    if (normalized === '') {
        return trimTrailingSlash(fallback);
    }

    return trimTrailingSlash(normalized ?? fallback);
};
const INTERNAL_PATH_PATTERN = /^\/(?![\\/])/;
export const DEFAULT_SERVER_URL = 'https://api.dutying.ai';

export const RUNTIME_CONFIG = {
    publicAppUrl: () => getRuntimeUrl(import.meta.env.VITE_APP_PUBLIC_URL, getWindowOrigin() ?? 'https://app.dutying.ai'),
    serverUrl: () => getRuntimeUrl(import.meta.env.VITE_SERVER_URL, DEFAULT_SERVER_URL),
    // 기본 프로필 이미지(`{base}/profile_img/default/profileN.png`)만 이 값을 쓴다.
    // 업로드 이미지는 서버가 전체 URL 로 내려준다.
    // `.ai` 전용 버킷으로 객체를 sync 해뒀다 — 구 `dutying-prod` 를 계속 가리키면
    // `.net` 을 닫는 순간 기본 프로필이 전부 깨진다.
    profileImageBaseUrl: () =>
        getRuntimeUrl(import.meta.env.VITE_PUBLIC_S3_BASE_URL, 'https://dutying-ai-prod.s3.ap-northeast-2.amazonaws.com'),
    docs: {
        termsOfService: getRuntimeUrl(
            import.meta.env.VITE_TERMS_OF_SERVICE_URL,
            'https://www.dutying.ai/terms',
        ),
        privacyPolicy: getRuntimeUrl(
            import.meta.env.VITE_PRIVACY_POLICY_URL,
            'https://www.dutying.ai/privacy',
        ),
        memberTutorial: import.meta.env.VITE_MEMBER_TUTORIAL_URL ?? 'https://gom3.notion.site/befb4602f83241ed896a1700eb592b35?pvs=4',
        requestTutorial: import.meta.env.VITE_REQUEST_TUTORIAL_URL ?? 'https://gom3.notion.site/befb4602f83241ed896a1700eb592b35?pvs=4',
        makeTutorial: import.meta.env.VITE_MAKE_TUTORIAL_URL ?? 'https://gom3.notion.site/68d3ad01e68d4d6a8b4cb8c2409353a3?pvs=4',
    },
} as const;

export const sanitizeInternalPath = (path: string | null | undefined, fallback: string = ROUTE.HOME) =>
    path && INTERNAL_PATH_PATTERN.test(path) ? path : fallback;

export const buildAppUrl = (path: string) => new URL(sanitizeInternalPath(path), `${RUNTIME_CONFIG.publicAppUrl()}/`).toString();

export const resolveSafeRedirectTarget = (target: string | null | undefined, fallback: string = ROUTE.HOME) => {
    if (target === 'back') return 'back';

    if (!target) return fallback;

    if (INTERNAL_PATH_PATTERN.test(target)) return target;

    try {
        const redirectUrl = new URL(target);
        const allowedOrigins = [getWindowOrigin(), RUNTIME_CONFIG.publicAppUrl()].filter((origin): origin is string => Boolean(origin));

        if (!allowedOrigins.includes(redirectUrl.origin)) {
            return fallback;
        }

        return `${sanitizeInternalPath(redirectUrl.pathname, fallback)}${redirectUrl.search}${redirectUrl.hash}`;
    } catch {
        return fallback;
    }
};

export const buildAuthAuthorizeUrl = (provider: 'kakao' | 'apple', nextPath: string = ROUTE.HOME) => {
    const url = new URL(`/oauth2/authorization/admin/${provider}`, `${RUNTIME_CONFIG.serverUrl()}/`);

    url.searchParams.set('nextPageUrl', buildAppUrl(sanitizeInternalPath(nextPath)));

    return url.toString();
};

export const buildLineAuthAuthorizeUrl = (nextPath: string = ROUTE.HOME) => {
    const url = new URL('/oauth/line/authorize', `${RUNTIME_CONFIG.serverUrl()}/`);

    url.searchParams.set('nextPageUrl', buildAppUrl(sanitizeInternalPath(nextPath)));

    return url.toString();
};
