import {describe, expect, it} from 'vitest';
import {
    ANDROID_PLAY_STORE_URL,
    buildFriendInviteAppUrl,
    buildFriendInviteSchemeUrl,
    buildMoimInviteAppUrl,
    buildMoimInviteSchemeUrl,
    IOS_APP_STORE_URL_DEFAULT,
    IOS_APP_STORE_URL_JA,
    IOS_APP_STORE_URL_KO,
    IOS_APP_STORE_URL,
    normalizeInviteSearch,
    resolveIosAppStoreUrl,
} from '../invite';

describe('invite link builders', () => {
    it('preserves the friend invite code query when building app links', () => {
        expect(buildFriendInviteAppUrl('https://app.dutying.ai/', '?code=9BECT3')).toBe(
            'https://app.dutying.ai/app/friends/invite?code=9BECT3',
        );
    });

    it('builds the custom scheme backup with the same query', () => {
        expect(buildFriendInviteSchemeUrl('code=9BECT3')).toBe('dutying://friends/invite?code=9BECT3');
    });

    it('preserves the moim invite code query when building app links', () => {
        expect(buildMoimInviteAppUrl('https://app.dutying.ai/', '?code=PXZ7XE')).toBe('https://app.dutying.ai/app/moim/invite?code=PXZ7XE');
    });

    it('builds the moim custom scheme backup with the same query', () => {
        expect(buildMoimInviteSchemeUrl('code=PXZ7XE')).toBe('dutying://moim/invite?code=PXZ7XE');
    });

    it('ignores blank search values', () => {
        expect(normalizeInviteSearch('   ')).toBe('');
        expect(buildFriendInviteAppUrl('https://app.dutying.ai', '')).toBe('https://app.dutying.ai/app/friends/invite');
    });

    it('uses the published iOS and Android store listings', () => {
        expect(IOS_APP_STORE_URL).toBe('https://apps.apple.com/us/app/dutying-nurse-shift-calendar/id6804144827');
        expect(IOS_APP_STORE_URL_DEFAULT).toBe('https://apps.apple.com/us/app/dutying-nurse-shift-calendar/id6804144827');
        expect(IOS_APP_STORE_URL_JA).toBe(
            'https://apps.apple.com/jp/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827',
        );
        expect(IOS_APP_STORE_URL_KO).toBe(
            'https://apps.apple.com/kr/app/dutying-%E7%9C%8B%E8%AD%B7%E5%B8%AB%E3%82%B7%E3%83%95%E3%83%88%E7%AE%A1%E7%90%86/id6804144827',
        );
        expect(ANDROID_PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=ai.dutying.app');
    });

    it('resolves the iOS store listing by language', () => {
        expect(resolveIosAppStoreUrl(['ja-JP', 'en-US'])).toBe(IOS_APP_STORE_URL_JA);
        expect(resolveIosAppStoreUrl(['ko-KR', 'en-US'])).toBe(IOS_APP_STORE_URL_KO);
        expect(resolveIosAppStoreUrl(['en-US'])).toBe(IOS_APP_STORE_URL_DEFAULT);
    });
});
