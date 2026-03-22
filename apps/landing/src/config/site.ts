const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const getRuntimeOrigin = (value: string | undefined, fallback: string) => {
    const normalized = value?.trim();

    if (normalized === '') {
        return stripTrailingSlash(fallback);
    }

    return stripTrailingSlash(normalized ?? fallback);
};

type SiteEnv = {
    PUBLIC_MARKETING_SITE_URL?: string;
    PUBLIC_APP_SITE_URL?: string;
};

const readSiteEnv = (): SiteEnv => ({
    PUBLIC_MARKETING_SITE_URL: import.meta.env.PUBLIC_MARKETING_SITE_URL,
    PUBLIC_APP_SITE_URL: import.meta.env.PUBLIC_APP_SITE_URL,
});

export const createSiteConfig = (env: SiteEnv = readSiteEnv()) => {
    const marketingOrigin = getRuntimeOrigin(env.PUBLIC_MARKETING_SITE_URL, 'https://dutying.net');
    const appOrigin = getRuntimeOrigin(env.PUBLIC_APP_SITE_URL, 'https://app.dutying.net');

    return {
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
};

export const createLandingPrimaryCtas = (config: ReturnType<typeof createSiteConfig>) => [
    {label: '근무표 작성 체험하기', href: config.appLinks.makeEntry},
    {label: '근무표 만들기', href: config.appLinks.make},
];

export const siteConfig = createSiteConfig(readSiteEnv());
export const landingPrimaryCtas = createLandingPrimaryCtas(siteConfig);
