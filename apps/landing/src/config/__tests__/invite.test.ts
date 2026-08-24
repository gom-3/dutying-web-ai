import {describe, expect, it} from 'vitest';
import {buildFriendInviteAppUrl, buildFriendInviteSchemeUrl, normalizeInviteSearch} from '../invite';

describe('invite link builders', () => {
    it('preserves the friend invite code query when building app links', () => {
        expect(buildFriendInviteAppUrl('https://app.dutying.ai/', '?code=9BECT3')).toBe(
            'https://app.dutying.ai/app/friends/invite?code=9BECT3',
        );
    });

    it('builds the custom scheme backup with the same query', () => {
        expect(buildFriendInviteSchemeUrl('code=9BECT3')).toBe('dutying://friends/invite?code=9BECT3');
    });

    it('ignores blank search values', () => {
        expect(normalizeInviteSearch('   ')).toBe('');
        expect(buildFriendInviteAppUrl('https://app.dutying.ai', '')).toBe('https://app.dutying.ai/app/friends/invite');
    });
});
