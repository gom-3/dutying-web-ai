const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const marketingOrigin = stripTrailingSlash(import.meta.env.PUBLIC_MARKETING_SITE_URL ?? 'https://dutying.net');
const appOrigin = stripTrailingSlash(import.meta.env.PUBLIC_APP_SITE_URL ?? 'https://app.dutying.net');
const docsOrigin = stripTrailingSlash(import.meta.env.PUBLIC_DOCS_SITE_URL ?? 'https://docs.dutying.net');
const termsUrl = import.meta.env.PUBLIC_TERMS_URL ?? 'https://gom3.notion.site/5ed51c04dd5d475c868367ed05a7d903?pvs=4';

export const siteConfig = {
    productName: 'Dutying',
    marketingOrigin,
    appOrigin,
    docsOrigin,
    legal: {
        terms: termsUrl,
    },
    appLinks: {
        home: appOrigin,
        login: `${appOrigin}/login`,
        makeEntry: `${appOrigin}/login?next=%2Fmake`,
        make: `${appOrigin}/make`,
        register: `${appOrigin}/register`,
    },
    docsLinks: {
        home: docsOrigin,
    },
};
