import {describe, expect, it} from 'vitest';
import {createLandingPrimaryCtas, createSiteConfig} from '../site';

describe('createSiteConfig', () => {
    it('falls back to the production dutying domains', () => {
        const config = createSiteConfig({});

        expect(config.marketingOrigin).toBe('https://www.dutying.ai');
        expect(config.appOrigin).toBe('https://app.dutying.ai');
        expect(config.docsOrigin).toBe('https://docs.dutying.ai');
        expect(config.legal.terms).toBe('https://www.dutying.ai/terms');
        expect(config.legal.privacyPolicy).toBe('https://www.dutying.ai/privacy');
        expect(config.legal.accountDeletion).toBe('https://www.dutying.ai/account-deletion');
        expect(config.appLinks).toEqual({
            home: 'https://app.dutying.ai',
            login: 'https://app.dutying.ai/login',
            signup: 'https://app.dutying.ai/signup',
            makeEntry: 'https://app.dutying.ai/login?next=%2Fmake',
            make: 'https://app.dutying.ai/make',
            register: 'https://app.dutying.ai/register',
            profile: 'https://app.dutying.ai/profile',
        });
        expect(config.marketingLinks).toEqual({
            home: 'https://www.dutying.ai',
            features: 'https://www.dutying.ai/features',
            faq: 'https://www.dutying.ai/faq',
            guide: 'https://www.dutying.ai/guide',
        });
    });

    it('trims trailing slashes from overridden origins before composing links', () => {
        const config = createSiteConfig({
            PUBLIC_MARKETING_SITE_URL: 'https://preview.dutying.ai///',
            PUBLIC_APP_SITE_URL: 'https://preview.app.dutying.ai//',
            PUBLIC_DOCS_SITE_URL: 'https://preview.docs.dutying.ai//',
            PUBLIC_TERMS_URL: 'https://example.com/terms',
            PUBLIC_PRIVACY_POLICY_URL: 'https://example.com/privacy',
        });

        expect(config.marketingOrigin).toBe('https://preview.dutying.ai');
        expect(config.docsLinks.home).toBe('https://preview.docs.dutying.ai');
        expect(config.legal.terms).toBe('https://example.com/terms');
        expect(config.legal.privacyPolicy).toBe('https://example.com/privacy');
        expect(config.appLinks.login).toBe('https://preview.app.dutying.ai/login');
        expect(config.appLinks.makeEntry).toBe('https://preview.app.dutying.ai/login?next=%2Fmake');
    });

    it('falls back safely when env overrides are blank strings', () => {
        const config = createSiteConfig({
            PUBLIC_MARKETING_SITE_URL: '   ',
            PUBLIC_APP_SITE_URL: '',
        });

        expect(config.marketingOrigin).toBe('https://www.dutying.ai');
        expect(config.appOrigin).toBe('https://app.dutying.ai');
        expect(config.appLinks.login).toBe('https://app.dutying.ai/login');
    });
});

describe('createLandingPrimaryCtas', () => {
    it('keeps the web CTA entrypoints pinned to the app login and make routes', () => {
        const ctas = createLandingPrimaryCtas(
            createSiteConfig({
                PUBLIC_APP_SITE_URL: 'https://staging.app.dutying.ai/',
            }),
        );

        expect(ctas).toEqual([
            {label: '근무표 작성 체험하기', href: 'https://staging.app.dutying.ai/login?next=%2Fmake'},
            {label: '근무표 만들기', href: 'https://staging.app.dutying.ai/make'},
        ]);
    });
});
