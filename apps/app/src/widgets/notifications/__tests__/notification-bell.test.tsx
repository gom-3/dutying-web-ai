import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import type * as ReactRouter from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NotificationBell} from '../notification-bell';

const {notificationApiMock, navigateMock, toastErrorMock} = vi.hoisted(() => ({
    notificationApiMock: {
        deleteNotification: vi.fn(),
        getNotifications: vi.fn(),
        getUnreadCount: vi.fn(),
        markAsRead: vi.fn(),
    },
    navigateMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accessToken: null},
    }),
}));

vi.mock('@/shared/api', () => ({
    NotificationAPI: notificationApiMock,
}));

vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof ReactRouter>();

    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('react-hot-toast', () => ({
    toast: {
        error: toastErrorMock,
    },
}));

const notification = {
    id: 64,
    content: '게시글에 새 댓글이 달렸습니다.',
    classification: 'WARD_BOARD_COMMENT',
    isRead: false,
    domain: 'BOARD',
    url: '/board?postId=64',
    createdAt: '2026-08-16T08:00:00+09:00',
};

function renderNotificationBell() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {retry: false},
            mutations: {retry: false},
        },
    });

    return render(
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>
                <NotificationBell />
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

describe('NotificationBell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        notificationApiMock.getUnreadCount.mockResolvedValue(1);
        notificationApiMock.getNotifications.mockResolvedValue([notification]);
        notificationApiMock.deleteNotification.mockResolvedValue(undefined);
        notificationApiMock.markAsRead.mockResolvedValue(undefined);
    });

    it('deletes an unread notification through the server without opening it', async () => {
        const user = userEvent.setup();

        notificationApiMock.getUnreadCount.mockResolvedValueOnce(1).mockResolvedValue(0);
        notificationApiMock.getNotifications.mockResolvedValueOnce([notification]).mockResolvedValue([]);
        renderNotificationBell();

        await user.click(screen.getByRole('button', {name: '알림 열기'}));
        await user.click(await screen.findByRole('button', {name: `${notification.content} 알림 삭제`}));

        expect(globalThis.confirm).toHaveBeenCalledWith('이 알림을 삭제할까요?');
        expect(notificationApiMock.deleteNotification).toHaveBeenCalledWith(64);
        expect(notificationApiMock.markAsRead).not.toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByText(notification.content)).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getByText('안 읽음 0')).toBeInTheDocument());
    });

    it('restores the notification and shows feedback when server deletion fails', async () => {
        const user = userEvent.setup();

        notificationApiMock.deleteNotification.mockRejectedValue(new Error('delete failed'));
        renderNotificationBell();

        await user.click(screen.getByRole('button', {name: '알림 열기'}));
        await user.click(await screen.findByRole('button', {name: `${notification.content} 알림 삭제`}));

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('알림을 삭제하지 못했어요.'));
        expect(await screen.findByText(notification.content)).toBeInTheDocument();
        expect(screen.getByText('안 읽음 1')).toBeInTheDocument();
    });
});
