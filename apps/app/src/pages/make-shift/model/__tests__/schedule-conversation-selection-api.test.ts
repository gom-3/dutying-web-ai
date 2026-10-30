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

describe('intent-first negotiated conversation wire', () => {
    it('sends one-operation interpretation negotiation with the bounded transport timeout', async () => {
        post.mockResolvedValueOnce({data: {interpretationId: 'i:1'}});
        await conversationApi(5, 7).interpret(9, {
            expectedRevision: 2,
            text: '3일 D로 바꿔줘',
            language: 'ko',
            authoringContractVersion: 'intent-first-v1',
        });
        expect(post).toHaveBeenLastCalledWith(
            '/wards/5/shift-teams/7/schedule/conversations/9/interpretations',
            {expectedRevision: 2, text: '3일 D로 바꿔줘', language: 'ko', authoringContractVersion: 'intent-first-v1'},
            {suppressErrorToast: true, timeout: 30000},
        );
    });
    it('sends exact cached candidate binding without creating a new interpretation or altering rule lifetime', async () => {
        const body = {
            expectedRevision: 2,
            idempotencyKey: 'retry:1',
            operationType: 'ADJUST' as const,
            authoringContractVersion: 'intent-first-v1' as const,
            interactionId: 'interaction:1',
            interpretationId: 'i:1',
            planHash: 'a'.repeat(64),
            sourceVersionId: 'version:1',
            sourceOperationId: 'operation:1',
            candidateDigest: 'candidate:1',
            conflictReviewToken: 'token:1',
            conflictConfirmed: true,
        };

        post.mockResolvedValueOnce({data: {operationId: 'op:2'}});
        await conversationApi(5, 7).execute(9, body);
        expect(post).toHaveBeenLastCalledWith('/wards/5/shift-teams/7/schedule/conversations/9/operations', body, {
            suppressErrorToast: true,
            timeout: 330000,
            headers: {Prefer: 'respond-async'},
        });
    });
});
