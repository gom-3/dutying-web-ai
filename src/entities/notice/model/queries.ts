import {queryOptions} from '@tanstack/react-query';
import {NoticeAPI} from '@/shared/api';
import {type IGetNoticeRequest} from '@/shared/api/notice';

export const noticeQueryKeys = {
    all: () => ['notice'],
    list: (req: IGetNoticeRequest) => [...noticeQueryKeys.all(), 'list', ...Object.values(req)],
    id: (noticeId: number) => [...noticeQueryKeys.all(), 'id', noticeId],
};

export const noticeQueryOptions = {
    list: (req: IGetNoticeRequest) =>
        queryOptions({
            queryKey: noticeQueryKeys.list(req),
            queryFn: () => NoticeAPI.getNotices(req),
        }),
    id: (id: number) =>
        queryOptions({
            queryKey: noticeQueryKeys.id(id),
            queryFn: () => NoticeAPI.getNotice(id),
        }),
};
