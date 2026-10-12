import {describe, expect, it, vi} from 'vitest';
import {conversationApi} from '../schedule-conversation-api';

const post = vi.hoisted(() => vi.fn());

vi.mock('@/shared/api/client', () => ({default: {post}}));

describe('condition selection API', () => {
    it('uses the authenticated scoped API and returns a new plan turn for review', async () => {
        const turn = {eventId: 3, interpretationId: 'selected', semanticPlan: {planId: 'child'}};

        post.mockResolvedValue({data: turn});

        const result = await conversationApi(5, 7).selectConditions(9, 'parent', 2, 'a'.repeat(64), ['condition:1']);

        expect(result).toEqual(turn);
        expect(post).toHaveBeenCalledWith(
            '/wards/5/shift-teams/7/schedule/conversations/9/plans/parent/selections',
            {
                expectedRevision: 2,
                planHash: 'a'.repeat(64),
                selectedConditionIds: ['condition:1'],
            },
            {suppressErrorToast: true, timeout: 330000},
        );
    });
});
