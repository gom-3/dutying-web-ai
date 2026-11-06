import {afterEach, describe, expect, it, vi} from 'vitest';
import {
    analyticsPageLocation,
    googleAnalyticsMeasurementId,
    isAuthenticationReferrer,
    isMarketingAnalyticsEnabled,
    metaPixelId,
    isMetaPixelLocationSafe,
} from '../analytics';

afterEach(() => vi.unstubAllEnvs());

describe('marketing analytics environment boundary', () => {
    it.each(['www.dutying.ai', 'dutying.ai', 'app.dutying.ai'])('allows production host %s', (host) => {
        vi.stubEnv('PROD', true);
        expect(isMarketingAnalyticsEnabled(host)).toBe(true);
    });

    it.each(['dev.dutying.ai', 'dev.app.dutying.ai', 'preview.pages.dev', 'app.dutying.net', 'unknown.example', 'localhost'])(
        'blocks %s even in a release build',
        (host) => {
            vi.stubEnv('PROD', true);
            expect(isMarketingAnalyticsEnabled(host)).toBe(false);
        },
    );

    it('does not collect from development builds', () => {
        vi.stubEnv('PROD', false);
        expect(isMarketingAnalyticsEnabled('www.dutying.ai')).toBe(false);
    });
});

it('uses the .ai stream even when deployment still contains the legacy ID', () => {
    vi.stubEnv('VITE_GA_TRACKING_ID', 'G-94QM502EQF');
    vi.stubEnv('VITE_AI_GA_TRACKING_ID', '');
    expect(googleAnalyticsMeasurementId()).toBe('G-WT44BR53VN');
});

it('preserves attribution while excluding credentials and private query values', () => {
    const result = new URL(
        analyticsPageLocation('/make', '?utm_source=instagram&utm_medium=paid_social&gclid=abc123&token=secret&email=nurse@example.com'),
    );

    expect(result.searchParams.get('utm_source')).toBe('instagram');
    expect(result.searchParams.get('gclid')).toBe('abc123');
    expect(result.searchParams.has('token')).toBe(false);
    expect(result.searchParams.has('email')).toBe(false);
});

it('excludes authentication referrers while preserving search and social acquisition', () => {
    expect(isAuthenticationReferrer('https://accounts.kakao.com/login')).toBe(true);
    expect(isAuthenticationReferrer('https://accounts.google.com/')).toBe(true);
    expect(isAuthenticationReferrer('https://www.google.com/search?q=dutying')).toBe(false);
    expect(isAuthenticationReferrer('https://www.instagram.com/')).toBe(false);
    expect(isAuthenticationReferrer('https://accounts.google.com.example.com/')).toBe(false);
    expect(isAuthenticationReferrer('')).toBe(false);
});

it('uses the company-owned Meta dataset even when legacy deployment configuration remains', () => {
    vi.stubEnv('VITE_PIXEL_ID', '225085720489207');
    vi.stubEnv('VITE_AI_META_PIXEL_ID', '');
    expect(metaPixelId()).toBe('1138075548924419');
});
it.each(['225085720489207', 'invalid', '0'])('rejects legacy or invalid dedicated Meta overrides: %s', (id) => {
    vi.stubEnv('VITE_AI_META_PIXEL_ID', id);
    expect(metaPixelId()).toBe('1138075548924419');
});
it('accepts an explicit numeric dedicated Meta override', () => {
    vi.stubEnv('VITE_AI_META_PIXEL_ID', '123456789');
    expect(metaPixelId()).toBe('123456789');
});

it.each([
    {pathname: '/oauth2/redirect', search: '', hash: ''},
    {pathname: '/login', search: '?accessToken=private', hash: ''},
    {pathname: '/login', search: '?email=test%40example.com', hash: ''},
    {pathname: '/login', search: '', hash: '#access_token=private'},
    {pathname: '/login', search: '?code=private', hash: ''},
])('blocks Pixel on authentication URLs: %o', (location) => {
    expect(isMetaPixelLocationSafe(location)).toBe(false);
});
it('allows ordinary marketing attribution without credential parameters', () => {
    expect(isMetaPixelLocationSafe({pathname: '/signup', search: '?utm_source=instagram&fbclid=ad-click', hash: ''})).toBe(true);
});
