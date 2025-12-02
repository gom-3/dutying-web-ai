import {queryOptions} from '@tanstack/react-query';
import {NotificationAPI} from '@/shared/api';

export const notificationQueryKeys = {
    all: () => ['notification'],
    list: () => [...notificationQueryKeys.all(), 'list'],
};

export const notificationQueryOptions = {
    list: () =>
        queryOptions({
            queryKey: notificationQueryKeys.list(),
            queryFn: () => NotificationAPI.getNotifications(),
        }),
};
