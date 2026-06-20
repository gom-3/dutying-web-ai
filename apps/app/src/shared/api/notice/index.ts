import {publicAxiosInstance} from '../client';

export type TNoticePlatform = 'IOS' | 'AOS' | 'WEB' | 'MOBILE' | 'ALL';

export type TNoticeListItem = {
    id: number;
    title: string;
    summary?: string;
    isPinned?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

export type TNoticeListResponse = {
    items: TNoticeListItem[];
    nextCursorId?: number;
    hasNext: boolean;
};

export type TNoticeDetail = {
    id: number;
    title: string;
    content: string;
    isPinned?: boolean;
    createdAt?: string;
    updatedAt?: string;
};

type TGetNoticesOptions = {
    platform?: TNoticePlatform;
    cursorId?: number;
    size?: number;
};

type TRawNoticeListResponse = Partial<TNoticeListResponse>;

const normalizeNoticeListResponse = (response: TRawNoticeListResponse): TNoticeListResponse => ({
    items: response.items ?? [],
    nextCursorId: response.nextCursorId,
    hasNext: response.hasNext ?? Boolean(response.nextCursorId),
});

class ApiNoticeAPI {
    public async getNotices(options: TGetNoticesOptions = {}) {
        const params = new URLSearchParams();

        if (options.platform) params.set('platform', options.platform);

        if (options.cursorId) params.set('cursorId', String(options.cursorId));

        if (options.size) params.set('size', String(options.size));

        const query = params.toString();
        const response = (await publicAxiosInstance.get<TRawNoticeListResponse>(`/notices/v2${query ? `?${query}` : ''}`)).data;

        return normalizeNoticeListResponse(response);
    }

    public async getNotice(noticeId: number) {
        return (await publicAxiosInstance.get<TNoticeDetail>(`/notices/v2/${noticeId}`)).data;
    }
}

export default new ApiNoticeAPI();
