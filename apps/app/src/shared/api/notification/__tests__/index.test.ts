import {beforeEach, describe, expect, it, vi} from 'vitest';
import NotificationAPI from '..';

const {mockDelete} = vi.hoisted(() => ({
    mockDelete: vi.fn(),
}));

vi.mock('../../client', () => ({
    default: {
        delete: mockDelete,
    },
}));

describe('NotificationAPI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deletes the notification from the server without showing the global API toast', async () => {
        mockDelete.mockResolvedValue({data: undefined});

        await expect(NotificationAPI.deleteNotification(64)).resolves.toBeUndefined();

        expect(mockDelete).toHaveBeenCalledWith('/notifications/64', {suppressErrorToast: true});
    });
});
