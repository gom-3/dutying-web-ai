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
    PUBLIC_DOCS_SITE_URL?: string;
    PUBLIC_TERMS_URL?: string;
    PUBLIC_PRIVACY_POLICY_URL?: string;
};

const readSiteEnv = (): SiteEnv => ({
    PUBLIC_MARKETING_SITE_URL: import.meta.env.PUBLIC_MARKETING_SITE_URL,
    PUBLIC_APP_SITE_URL: import.meta.env.PUBLIC_APP_SITE_URL,
    PUBLIC_DOCS_SITE_URL: import.meta.env.PUBLIC_DOCS_SITE_URL,
    PUBLIC_TERMS_URL: import.meta.env.PUBLIC_TERMS_URL,
    PUBLIC_PRIVACY_POLICY_URL: import.meta.env.PUBLIC_PRIVACY_POLICY_URL,
});

export const createSiteConfig = (env: SiteEnv = readSiteEnv()) => {
    // canonical 호스트는 www 다. apex 는 Cloudflare Redirect Rule 로 301 되므로
    // 여기에 apex 를 두면 "리다이렉트되는 URL 을 canonical 로 지정"하는 안티패턴이 된다.
    const marketingOrigin = getRuntimeOrigin(env.PUBLIC_MARKETING_SITE_URL, 'https://www.dutying.ai');
    const appOrigin = getRuntimeOrigin(env.PUBLIC_APP_SITE_URL, 'https://app.dutying.ai');
    const docsOrigin = getRuntimeOrigin(env.PUBLIC_DOCS_SITE_URL, 'https://docs.dutying.ai');
    const termsUrl = env.PUBLIC_TERMS_URL ?? `${marketingOrigin}/terms`;
    const privacyPolicyUrl = env.PUBLIC_PRIVACY_POLICY_URL ?? `${marketingOrigin}/privacy`;

    return {
        productName: 'Dutying',
        marketingOrigin,
        appOrigin,
        docsOrigin,
        legal: {
            terms: termsUrl,
            privacyPolicy: privacyPolicyUrl,
            accountDeletion: `${marketingOrigin}/account-deletion`,
        },
        appLinks: {
            home: appOrigin,
            login: `${appOrigin}/login`,
            signup: `${appOrigin}/signup`,
            makeEntry: `${appOrigin}/login?next=%2Fmake`,
            make: `${appOrigin}/make`,
            register: `${appOrigin}/register`,
            profile: `${appOrigin}/profile`,
        },
        marketingLinks: {
            home: marketingOrigin,
            features: `${marketingOrigin}/features`,
            faq: `${marketingOrigin}/faq`,
            guide: `${marketingOrigin}/guide`,
        },
        docsLinks: {
            home: docsOrigin,
        },
    };
};

export const createLandingPrimaryCtas = (config: ReturnType<typeof createSiteConfig>) => [
    {label: '근무표 작성 체험하기', href: config.appLinks.makeEntry},
    {label: '근무표 만들기', href: config.appLinks.make},
];

export const siteConfig = createSiteConfig(readSiteEnv());
export const landingPrimaryCtas = createLandingPrimaryCtas(siteConfig);
