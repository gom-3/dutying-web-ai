import {describe, expect, it} from 'vitest';
import {
    ANDROID_PLAY_STORE_URL,
    buildFriendInviteAppUrl,
    buildFriendInviteSchemeUrl,
    buildMoimInviteAppUrl,
    buildMoimInviteSchemeUrl,
    IOS_APP_STORE_URL,
    normalizeInviteSearch,
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
        expect(IOS_APP_STORE_URL).toBe('https://apps.apple.com/kr/app/id6466558189');
        expect(ANDROID_PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=ai.dutying.app');
    });
});
