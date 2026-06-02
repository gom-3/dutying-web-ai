import axiosInstance from '../client';

export type TWardBoardPost = {
    id?: number;
    postId?: number;
    title: string;
    content: string;
    authorName?: string;
    writerName?: string;
    createdAt?: string;
    modifiedAt?: string;
    isMine?: boolean;
    isNotice?: boolean;
    viewCount?: number;
    likeCount?: number;
    isLikedByMe?: boolean;
    checkCount?: number;
    isCheckedByMe?: boolean;
    checkedUserNames?: string[];
    imageUrls?: string[];
    commentCount?: number;
    deadlineDate?: string;
};

export type TWardBoardComment = {
    id?: number;
    commentId?: number;
    content: string;
    authorName?: string;
    isMine?: boolean;
    createdAt?: string;
    modifiedAt?: string;
    replies?: TWardBoardComment[];
};

export type TWardBoardChecker = {
    accountId?: number;
    name: string;
};

export type TWardBoardDeadline = {
    postId: number;
    postTitle: string;
    deadlineDate: string;
    writerName?: string;
};

export type TWardBoardSchedule = {
    id?: number;
    scheduleId?: number;
    title: string;
    content?: string;
    scheduleDate: string;
    startTime?: string;
    endTime?: string;
    writerName?: string;
    authorName?: string;
    createdAt?: string;
    modifiedAt?: string;
    isMine?: boolean;
};

type TPostListResponse = {
    posts?: TWardBoardPost[];
    items?: TWardBoardPost[];
    data?: TWardBoardPost[];
    nextCursorId?: number;
    hasNext?: boolean;
};

type TCommentListResponse = {
    comments?: TWardBoardComment[];
    items?: TWardBoardComment[];
    data?: TWardBoardComment[];
    nextCursorId?: number;
};

type TScheduleListResponse = {
    schedules?: TWardBoardSchedule[];
    items?: TWardBoardSchedule[];
    data?: TWardBoardSchedule[];
};

export type TCreateWardBoardPostDTO = {
    title: string;
    content: string;
    deadlineDate?: string;
    imageUrls?: string[];
};

export type TCreateWardBoardScheduleDTO = {
    title: string;
    content?: string;
    scheduleDate: string;
    startTime?: string;
    endTime?: string;
};

export type TUpdateWardBoardScheduleDTO = TCreateWardBoardScheduleDTO;

type TCreateWardBoardCommentDTO = {
    content: string;
};

const readPostId = (post: TWardBoardPost) => post.postId ?? post.id ?? 0;
const readScheduleId = (schedule: TWardBoardSchedule) => schedule.scheduleId ?? schedule.id ?? 0;
const normalizePosts = (response: TPostListResponse) => response.posts ?? response.items ?? response.data ?? [];
const normalizeComments = (response: TCommentListResponse) => response.comments ?? response.items ?? response.data ?? [];
const normalizeSchedules = (response: TScheduleListResponse | TWardBoardSchedule[]) =>
    Array.isArray(response) ? response : (response.schedules ?? response.items ?? response.data ?? []);

class ApiBoardAPI {
    public async getPosts(wardId: number, options?: {cursorId?: number; size?: number; keyword?: string}) {
        const params = new URLSearchParams();

        if (options?.cursorId) params.set('cursorId', String(options.cursorId));

        if (options?.size) params.set('size', String(options.size));

        if (options?.keyword?.trim()) params.set('keyword', options.keyword.trim());

        const query = params.toString();
        const response = (await axiosInstance.get<TPostListResponse>(`/wards/${wardId}/board/posts${query ? `?${query}` : ''}`)).data;

        return {
            posts: normalizePosts(response),
            nextCursorId: response.nextCursorId,
            hasNext: response.hasNext ?? Boolean(response.nextCursorId),
        };
    }

    public async getPost(wardId: number, postId: number) {
        return (await axiosInstance.get<TWardBoardPost>(`/wards/${wardId}/board/posts/${postId}`)).data;
    }

    public async createPost(wardId: number, post: TCreateWardBoardPostDTO) {
        const payload: TCreateWardBoardPostDTO = {
            title: post.title,
            content: post.content,
        };

        if (post.deadlineDate) payload.deadlineDate = post.deadlineDate;

        if (post.imageUrls?.length) payload.imageUrls = post.imageUrls;

        return (await axiosInstance.post<TWardBoardPost>(`/wards/${wardId}/board/posts`, payload)).data;
    }

    public async deletePost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}`)).data;
    }

    public async likePost(wardId: number, postId: number) {
        return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
    }

    public async unlikePost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/likes`)).data;
    }

    public async checkPost(wardId: number, postId: number) {
        return (await axiosInstance.put<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
    }

    public async uncheckPost(wardId: number, postId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/posts/${postId}/checks`)).data;
    }

    public async getCheckers(wardId: number, postId: number) {
        const response = (
            await axiosInstance.get<{checkers?: TWardBoardChecker[]; checkedUserNames?: string[]}>(
                `/wards/${wardId}/board/posts/${postId}/checkers`,
            )
        ).data;
        const checkers: TWardBoardChecker[] =
            response.checkers ?? response.checkedUserNames?.map((name) => ({accountId: undefined, name})) ?? [];

        return {
            checkers,
            checkedUserNames: response.checkedUserNames ?? checkers.map((checker) => checker.name),
        };
    }

    public async getComments(wardId: number, postId: number, options?: {cursorId?: number; size?: number}) {
        const params = new URLSearchParams();

        if (options?.cursorId) params.set('cursorId', String(options.cursorId));

        if (options?.size) params.set('size', String(options.size));

        const query = params.toString();
        const response = (
            await axiosInstance.get<TCommentListResponse>(`/wards/${wardId}/board/posts/${postId}/comments${query ? `?${query}` : ''}`)
        ).data;

        return {
            comments: normalizeComments(response),
            nextCursorId: response.nextCursorId,
        };
    }

    public async createComment(wardId: number, postId: number, comment: TCreateWardBoardCommentDTO) {
        return (await axiosInstance.post<TWardBoardComment>(`/wards/${wardId}/board/posts/${postId}/comments`, comment)).data;
    }

    public async deleteComment(wardId: number, commentId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/comments/${commentId}`)).data;
    }

    public async createReply(wardId: number, commentId: number, comment: TCreateWardBoardCommentDTO) {
        return (await axiosInstance.post<TWardBoardComment>(`/wards/${wardId}/board/comments/${commentId}/replies`, comment)).data;
    }

    public async getDeadlines(wardId: number, startDate: string, endDate: string) {
        const query = new URLSearchParams({startDate, endDate}).toString();

        return (await axiosInstance.get<TWardBoardDeadline[]>(`/wards/${wardId}/board/deadlines?${query}`)).data;
    }

    public async getSchedules(wardId: number, startDate: string, endDate: string) {
        const query = new URLSearchParams({startDate, endDate}).toString();
        const response = (
            await axiosInstance.get<TScheduleListResponse | TWardBoardSchedule[]>(`/wards/${wardId}/board/schedules?${query}`)
        ).data;

        return normalizeSchedules(response);
    }

    public async createSchedule(wardId: number, schedule: TCreateWardBoardScheduleDTO) {
        return (await axiosInstance.post<TWardBoardSchedule>(`/wards/${wardId}/board/schedules`, schedule)).data;
    }

    public async updateSchedule(wardId: number, scheduleId: number, schedule: TUpdateWardBoardScheduleDTO) {
        return (await axiosInstance.put<TWardBoardSchedule>(`/wards/${wardId}/board/schedules/${scheduleId}`, schedule)).data;
    }

    public async deleteSchedule(wardId: number, scheduleId: number) {
        return (await axiosInstance.delete<void>(`/wards/${wardId}/board/schedules/${scheduleId}`)).data;
    }

    public getPostId(post: TWardBoardPost) {
        return readPostId(post);
    }

    public getScheduleId(schedule: TWardBoardSchedule) {
        return readScheduleId(schedule);
    }
}

export default new ApiBoardAPI();
