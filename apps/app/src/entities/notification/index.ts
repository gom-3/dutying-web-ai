import {queryOptions} from '@tanstack/react-query';
import {NotificationAPI} from '@/shared/api';
import type {TGetNotificationsOptions, TNotificationDomain} from '@/shared/api/notification';

export const notificationQueryKeys = {
    all: () => ['notifications'] as const,
    list: (options: TGetNotificationsOptions = {}) => [...notificationQueryKeys.all(), 'list', options] as const,
    unreadCount: (domain?: TNotificationDomain) => [...notificationQueryKeys.all(), 'unread-count', domain ?? 'ALL'] as const,
};

export const notificationQueryOptions = {
    list: (options: TGetNotificationsOptions = {}) =>
        queryOptions({
            queryKey: notificationQueryKeys.list(options),
            queryFn: () => NotificationAPI.getNotifications(options),
        }),
    unreadCount: (domain?: TNotificationDomain) =>
        queryOptions({
            queryKey: notificationQueryKeys.unreadCount(domain),
            queryFn: () => NotificationAPI.getUnreadCount(domain),
        }),
};
