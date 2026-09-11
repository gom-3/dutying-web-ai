import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isAiAdjustEnabled, isNonProductionAppDomain, isOnboardingWardCreatePreviewAllowed, isWardChatEnabled} from '../feature-flags';

describe('isNonProductionAppDomain', () => {
    it('treats production app host as production', () => {
        expect(isNonProductionAppDomain('app.dutying.ai')).toBe(false);
        expect(isNonProductionAppDomain('app.dutying.net')).toBe(false);
    });

    it('treats dev and preview hosts as non-production', () => {
        expect(isNonProductionAppDomain('dev.dutying.ai')).toBe(true);
        expect(isNonProductionAppDomain('dev.dutying.net')).toBe(true);
        expect(isNonProductionAppDomain('local.app.dutying.net')).toBe(true);
        expect(isNonProductionAppDomain('dutying-app-git-feat.vercel.app')).toBe(true);
        expect(isNonProductionAppDomain('dutying-web-ai.pages.dev')).toBe(true);
        expect(isNonProductionAppDomain('localhost')).toBe(true);
    });
});

describe('isOnboardingWardCreatePreviewAllowed', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_ALLOW_ONBOARDING_PREVIEW', '');
        vi.stubGlobal('window', {location: {hostname: 'app.dutying.ai'}});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('blocks preview on production app domain', () => {
        expect(isOnboardingWardCreatePreviewAllowed()).toBe(false);
    });

    it('allows preview on dev app domain', () => {
        vi.stubGlobal('window', {location: {hostname: 'dev.dutying.ai'}});

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(true);
    });

    it('allows preview on vercel preview hostnames', () => {
        vi.stubGlobal('window', {
            location: {hostname: 'dutying-app-git-feat-foo-gom3.vercel.app'},
        });

        expect(isOnboardingWardCreatePreviewAllowed()).toBe(true);
    });

    it('respects VITE_ALLOW_ONBOARDING_PREVIEW=false override', () => {
        vi.stubGlobal('window', {location: {hostname: 'dev.dutying.ai'}});
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

    it('disables ward chat against the legacy .net API which lacks chat routes', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');

        expect(isWardChatEnabled()).toBe(false);
    });

    it('allows ward chat against the .ai production API which serves chat routes', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.ai');

        expect(isWardChatEnabled()).toBe(true);
    });

    it('allows ward chat against dev API', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://dev.api.dutying.ai');

        expect(isWardChatEnabled()).toBe(true);
    });

    it('respects explicit override', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');
        vi.stubEnv('VITE_ENABLE_WARD_CHAT', 'true');

        expect(isWardChatEnabled()).toBe(true);
    });
});

describe('isAiAdjustEnabled', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('서버가 열어 준 계정에서만 켠다', () => {
        expect(isAiAdjustEnabled(true)).toBe(true);
        expect(isAiAdjustEnabled(false)).toBe(false);
    });

    it('서버 응답에 값이 없으면(구 서버) 끈다', () => {
        expect(isAiAdjustEnabled(undefined)).toBe(false);
    });

    it('로컬 override 로 강제할 수 있다', () => {
        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'true');
        expect(isAiAdjustEnabled(false)).toBe(true);

        vi.stubEnv('VITE_AI_ADJUST_ENABLED', 'false');
        expect(isAiAdjustEnabled(true)).toBe(false);
    });
});
