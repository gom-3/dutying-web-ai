import {beforeEach, describe, expect, it, vi} from 'vitest';
import BoardAPI from '..';

const {mockPost} = vi.hoisted(() => ({
    mockPost: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        post: mockPost,
    },
}));

describe('BoardAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a post with a JSON body instead of query params', async () => {
        const payload = {title: '123', content: '123'};
        const response = {...payload, postId: 1};

        mockPost.mockResolvedValue({data: response});

        await expect(BoardAPI.createPost(287, {...payload, imageUrls: [], deadlineDate: undefined})).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/posts', payload);
    });

    it('keeps optional post fields in the JSON body when present', async () => {
        const payload = {
            title: 'notice',
            content: 'please check',
            deadlineDate: '2026-06-10',
            imageUrls: ['https://example.com/post.png'],
        };
        const response = {...payload, postId: 2};

        mockPost.mockResolvedValue({data: response});

        await expect(BoardAPI.createPost(287, payload)).resolves.toBe(response);

        expect(mockPost).toHaveBeenCalledWith('/wards/287/board/posts', payload);
    });
});
