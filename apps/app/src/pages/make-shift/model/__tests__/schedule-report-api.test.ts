import {beforeEach, describe, expect, it, vi} from 'vitest';
import {conversationApi} from '../schedule-conversation-api';

const {post} = vi.hoisted(() => ({post: vi.fn()}));

vi.mock('@/shared/api/client', () => ({default: {post}}));

beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({data: {incidentId: 'accepted:1'}});
});
describe('report API compatibility', () => {
    it('preserves the original three-argument request and response', async () => {
        await expect(conversationApi(1, 2).report(3, 'operation:1', '의견')).resolves.toEqual({incidentId: 'accepted:1'});
        expect(post).toHaveBeenCalledWith(
            '/wards/1/shift-teams/2/schedule/conversations/3/reports',
            {operationId: 'operation:1', note: '의견'},
            expect.any(Object),
        );
    });
    it('adds only the optional key and sends the same body on retry', async () => {
        post.mockRejectedValueOnce(new Error('response lost'));

        const api = conversationApi(1, 2);
        const key = crypto.randomUUID();

        await expect(api.report(3, 'operation:1', '의견', key)).rejects.toThrow('response lost');
        await expect(api.report(3, 'operation:1', '의견', key)).resolves.toEqual({incidentId: 'accepted:1'});
        expect(post.mock.calls[0][1]).toEqual({operationId: 'operation:1', note: '의견', idempotencyKey: key});
        expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
    });
});
