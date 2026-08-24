import {describe, expect, it} from 'vitest';
import {buildFriendInviteAppUrl, buildFriendInviteSchemeUrl, normalizeInviteSearch} from '../invite';

describe('invite link builders', () => {
    it('preserves the friend invite code query when building app links', () => {
        expect(buildFriendInviteAppUrl('?code=UVWB2T')).toBe('https://app.dutying.ai/app/friends/invite?code=UVWB2T');
    });

    it('builds the custom scheme backup with the same query', () => {
        expect(buildFriendInviteSchemeUrl('code=UVWB2T')).toBe('dutying://friends/invite?code=UVWB2T');
    });

    it('ignores blank search values', () => {
        expect(normalizeInviteSearch('   ')).toBe('');
        expect(buildFriendInviteAppUrl('')).toBe('https://app.dutying.ai/app/friends/invite');
    });
});
