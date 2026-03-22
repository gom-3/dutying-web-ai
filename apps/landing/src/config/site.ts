const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const marketingOrigin = stripTrailingSlash(import.meta.env.PUBLIC_MARKETING_SITE_URL ?? 'https://dutying.net');
const appOrigin = stripTrailingSlash(import.meta.env.PUBLIC_APP_SITE_URL ?? 'https://app.dutying.net');

export const siteConfig = {
    productName: 'Dutying',
    marketingOrigin,
    appOrigin,
    appLinks: {
        home: appOrigin,
        login: `${appOrigin}/login`,
        makeEntry: `${appOrigin}/login?next=%2Fmake`,
        make: `${appOrigin}/make`,
        register: `${appOrigin}/register`,
    },
};
