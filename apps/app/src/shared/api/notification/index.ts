import axiosInstance from '../client';

export type TNotificationDomain = 'BOARD' | 'CALENDAR' | 'ADMIN_BROADCAST' | 'NULTALK' | string;

export type TNotification = {
    id: number;
    receiverId?: number;
    content: string;
    url?: string | null;
    classification: string;
    isRead: boolean;
    createdAt?: string;
    imgBase64?: string | null;
    imgUrl?: string | null;
    domain?: TNotificationDomain | null;
    sourceType?: string | null;
    sourceId?: number | null;
    actorAccountId?: number | null;
};

export type TGetNotificationsOptions = {
    domain?: TNotificationDomain;
    cursorId?: number;
    size?: number;
    isRead?: boolean;
};

type TUnreadCountResponse = {
    unreadNotificationCount?: number;
    count?: number;
};

class ApiNotificationAPI {
    public async getNotifications(options: TGetNotificationsOptions = {}) {
        const params = new URLSearchParams();

        if (options.domain) params.set('domain', options.domain);

        if (options.cursorId) params.set('cursorId', String(options.cursorId));

        if (options.size) params.set('size', String(options.size));

        if (options.isRead !== undefined) params.set('isRead', String(options.isRead));

        const query = params.toString();

        return (await axiosInstance.get<TNotification[]>(`/notifications${query ? `?${query}` : ''}`)).data;
    }

    public async getUnreadCount(domain?: TNotificationDomain) {
        const query = domain ? `?${new URLSearchParams({domain}).toString()}` : '';
        const response = (await axiosInstance.get<TUnreadCountResponse>(`/notifications/unread-count${query}`)).data;

        return response.unreadNotificationCount ?? response.count ?? 0;
    }

    public async markAsRead(notificationId: number) {
        return (await axiosInstance.put<void>(`/notifications/${notificationId}/read`)).data;
    }
}

export default new ApiNotificationAPI();
