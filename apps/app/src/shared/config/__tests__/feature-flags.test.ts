import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isNonProductionAppDomain, isOnboardingWardCreatePreviewAllowed, isWardChatEnabled} from '../feature-flags';

describe('isNonProductionAppDomain', () => {
    it('treats production app host as production', () => {
        expect(isNonProductionAppDomain('app.dutying.net')).toBe(false);
    });

    it('treats dev and preview hosts as non-production', () => {
        expect(isNonProductionAppDomain('dev.dutying.net')).toBe(true);
        expect(isNonProductionAppDomain('local.app.dutying.net')).toBe(true);
        expect(isNonProductionAppDomain('dutying-app-git-feat.vercel.app')).toBe(true);
        expect(isNonProductionAppDomain('localhost')).toBe(true);
    });
});

describe('isOnboardingWardCreatePreviewAllowed', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_ALLOW_ONBOARDING_PREVIEW', '');
        vi.stubGlobal('window', {location: {hostname: 'app.dutying.net'}});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('blocks preview on production app domain', () => {
        expect(isOnboardingWardCreatePreviewAllowed()).toBe(false);
    });

    it('allows preview on dev app domain', () => {
        vi.stubGlobal('window', {location: {hostname: 'dev.dutying.net'}});

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(true);
    });

    it('allows preview on vercel preview hostnames', () => {
        vi.stubGlobal('window', {
            location: {hostname: 'dutying-app-git-feat-foo-gom3.vercel.app'},
        });

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(true);
    });

    it('respects VITE_ALLOW_ONBOARDING_PREVIEW=false override', () => {
        vi.stubGlobal('window', {location: {hostname: 'dev.dutying.net'}});
        vi.stubEnv('VITE_ALLOW_ONBOARDING_PREVIEW', 'false');

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(false);
    });

    it('respects VITE_ALLOW_ONBOARDING_PREVIEW=true override on production domain', () => {
        vi.stubEnv('VITE_ALLOW_ONBOARDING_PREVIEW', 'true');

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(true);
    });
});

describe('isWardChatEnabled', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_ENABLE_WARD_CHAT', '');
        vi.stubEnv('VITE_SERVER_URL', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('disables ward chat against production API while it lacks chat routes', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');

        expect(isWardChatEnabled()).toBe(false);
    });

    it('allows ward chat against dev API', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://dev.api.dutying.net');

        expect(isWardChatEnabled()).toBe(true);
    });

    it('respects explicit override', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');
        vi.stubEnv('VITE_ENABLE_WARD_CHAT', 'true');

        expect(isWardChatEnabled()).toBe(true);
    });
});
