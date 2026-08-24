import {describe, expect, it} from 'vitest';
import {
    buildFriendInviteAppUrl,
    buildFriendInviteSchemeUrl,
    buildMoimInviteAppUrl,
    buildMoimInviteSchemeUrl,
    normalizeInviteSearch,
} from '../invite';

describe('invite link builders', () => {
    it('preserves the friend invite code query when building app links', () => {
        expect(buildFriendInviteAppUrl('?code=UVWB2T')).toBe('https://app.dutying.ai/app/friends/invite?code=UVWB2T');
    });

    it('builds the custom scheme backup with the same query', () => {
        expect(buildFriendInviteSchemeUrl('code=UVWB2T')).toBe('dutying://friends/invite?code=UVWB2T');
    });

    it('preserves the moim invite code query when building app links', () => {
        expect(buildMoimInviteAppUrl('?code=PXZ7XE')).toBe('https://app.dutying.ai/app/moim/invite?code=PXZ7XE');
    });

    it('builds the moim custom scheme backup with the same query', () => {
        expect(buildMoimInviteSchemeUrl('code=PXZ7XE')).toBe('dutying://moim/invite?code=PXZ7XE');
    });

    it('ignores blank search values', () => {
        expect(normalizeInviteSearch('   ')).toBe('');
        expect(buildFriendInviteAppUrl('')).toBe('https://app.dutying.ai/app/friends/invite');
    });
});
