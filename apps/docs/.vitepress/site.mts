const DEFAULT_MARKETING_SITE_URL = 'https://dutying.net';
const DEFAULT_APP_SITE_URL = 'https://app.dutying.net';
const DEFAULT_DOCS_SITE_URL = 'https://docs.dutying.net';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const siteOrigin = (value: string | undefined, fallback: string) => stripTrailingSlash(value?.trim() || fallback);

export const docsSiteConfig = {
    marketingOrigin: siteOrigin(process.env.PUBLIC_MARKETING_SITE_URL, DEFAULT_MARKETING_SITE_URL),
    appOrigin: siteOrigin(process.env.PUBLIC_APP_SITE_URL, DEFAULT_APP_SITE_URL),
    docsOrigin: siteOrigin(process.env.PUBLIC_DOCS_SITE_URL, DEFAULT_DOCS_SITE_URL),
};

export const docsSiteLinks = {
    app: docsSiteConfig.appOrigin,
    marketing: docsSiteConfig.marketingOrigin,
    docs: docsSiteConfig.docsOrigin,
};
