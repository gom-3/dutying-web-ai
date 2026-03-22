import ROUTE from '@/shared/constant/path';

const DEFAULT_APP_SITE_URL = 'https://app.dutying.net';
const DEFAULT_MARKETING_SITE_URL = 'https://dutying.net';
const DEFAULT_DOCS_SITE_URL = 'https://docs.dutying.net';
const DEFAULT_TERMS_URL = 'https://gom3.notion.site/5ed51c04dd5d475c868367ed05a7d903?pvs=4';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const normalizeSiteOrigin = (value: string | undefined, fallback: string) => stripTrailingSlash(value?.trim() || fallback);

export const toAppRedirectPath = (value: string | null | undefined, appOrigin: string) => {
    if (value === null) return null;
    if (!value) return undefined;
    if (value === 'back') return 'back';

    if (value.startsWith('/')) {
        return value.startsWith('//') ? undefined : value;
    }

    try {
        const url = new URL(value);

        if (stripTrailingSlash(url.origin) !== appOrigin) {
            return undefined;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return undefined;
    }
};

export const siteConfig = {
    appOrigin: normalizeSiteOrigin(import.meta.env.VITE_APP_SITE_URL, DEFAULT_APP_SITE_URL),
    marketingOrigin: normalizeSiteOrigin(import.meta.env.VITE_MARKETING_SITE_URL, DEFAULT_MARKETING_SITE_URL),
    docsOrigin: normalizeSiteOrigin(import.meta.env.VITE_DOCS_SITE_URL, DEFAULT_DOCS_SITE_URL),
    legal: {
        terms: import.meta.env.VITE_TERMS_URL ?? DEFAULT_TERMS_URL,
    },
};

export const appLinks = {
    home: siteConfig.appOrigin,
    login: `${siteConfig.appOrigin}${ROUTE.LOGIN}`,
    register: `${siteConfig.appOrigin}${ROUTE.REGISTER}`,
    make: `${siteConfig.appOrigin}${ROUTE.MAKE}`,
    makeEntry: `${siteConfig.appOrigin}${ROUTE.LOGIN}?next=${encodeURIComponent(ROUTE.MAKE)}`,
    docs: siteConfig.docsOrigin,
    marketing: siteConfig.marketingOrigin,
};

export const toAbsoluteAppUrl = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${siteConfig.appOrigin}${normalizedPath}`;
};

export const createOAuthAuthorizationUrl = (provider: 'kakao' | 'apple', nextPath = ROUTE.MAKE) =>
    `${import.meta.env.VITE_SERVER_URL}/oauth2/authorization/${provider}?nextPageUrl=${encodeURIComponent(toAbsoluteAppUrl(nextPath))}`;
